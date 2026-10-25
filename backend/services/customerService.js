const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const JobOrder = require('../models/JobOrder');
const common = require('../utils/common');
const { assignedCountryIdsOf, loadCountries } = require('./taxSettingsService');
const { LIVE_STATUSES } = require('../constants/masterConstants');
const { CUSTOMER_SEARCH_RESULTS } = require('../constants/customerConstants');

// The vendor's customers (Customers module), saved from job orders: never
// created here. One live customer per phone and per email - a job order
// naming a saved phone or email updates that customer with its newest
// details instead of adding another. Old job orders keep their own copy of
// the customer, so editing or deleting one here never changes them.

const LIVE = { $in: LIVE_STATUSES };
const FIELDS = '_id name phone email address lastJobOrderAt status createdAt updatedAt';
const ADDRESS_PARTS = ['countryId', 'stateId', 'cityId', 'postalCode', 'address'];

const idOf = (value) => String(value);
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Any part of the name, phone, email or address.
const searchFilterOf = (search) => {
    try {
        const pattern = new RegExp(escapeRegex(search), 'i');
        return {
            $or: ['name', 'phone', 'email', 'address.address', 'address.postalCode', 'address.cityName', 'address.stateName', 'address.countryName']
                .map((field) => ({ [field]: pattern }))
        };
    } catch (err) {
        throw err;
    }
};

// The vendor's countries as the address fields need them.
const countriesOf = async (companyMasterData) => {
    try {
        const countries = await loadCountries(assignedCountryIdsOf(companyMasterData));
        return countries.map(({ _id, name, states, cities, postalCode }) => ({ _id, name, states, cities, postalCode }));
    } catch (err) {
        throw err;
    }
};

/**
 * A customer's address (on a job order, or edited here): field errors under
 * prefix ("customer.cityId") and what to store, names copied in.
 */
const checkAddress = (countries, input, prefix) => {
    try {
        const errors = [];
        const add = (field, message) => errors.push({ field: `${prefix}.${field}`, message });
        const country = input.countryId ? countries.find((c) => String(c._id) === input.countryId) : null;
        const state = country && input.stateId ? country.states.find((s) => String(s._id) === input.stateId) : null;
        const city = state && input.cityId ? country.cities.find((c) => String(c._id) === input.cityId && String(c.stateId) === input.stateId) : null;

        if (input.countryId && !country) add('countryId', 'Choose one of your countries');
        if (input.stateId && !state) add('stateId', 'Choose a state of the chosen country');
        if (input.cityId && !city) add('cityId', 'Choose a city of the chosen state');
        const postal = country?.postalCode || {};
        if (input.postalCode && postal.pattern && !new RegExp(postal.pattern).test(input.postalCode)) {
            add('postalCode', postal.patternMessage || `Enter a valid ${postal.label || 'postal code'}`);
        }

        return {
            errors,
            stored: {
                countryId: country?._id ?? null,
                countryName: country?.name ?? null,
                stateId: state?._id ?? null,
                stateName: state?.name ?? null,
                cityId: city?._id ?? null,
                cityName: city?.name ?? null,
                postalCode: input.postalCode ?? null,
                address: input.address ?? null
            }
        };
    } catch (err) {
        throw err;
    }
};

// Whether any part of an address was given.
const hasAddress = (address) => ADDRESS_PARTS.some((part) => address?.[part]);

// The phone or email of another customer -> 409 on that field.
const DUPLICATE_FIELDS = {
    phone: 'This phone number is already saved for another customer.',
    email: 'This email is already saved for another customer.'
};
const duplicateResult = (err) => {
    try {
        if (err?.code !== 11000) return null;
        const field = Object.keys(err.keyPattern || {}).find((name) => DUPLICATE_FIELDS[name]);
        if (!field) return null;
        return common.returnResult(false, 409, DUPLICATE_FIELDS[field], { errors: [{ field, message: DUPLICATE_FIELDS[field] }] });
    } catch (error) {
        throw error;
    }
};

// ---- from job orders --------------------------------------------------------

/**
 * Saves the customer of a job order being saved: the customer with the same
 * phone (or else the same email) gets the newest details - a phone or email
 * of another customer stays with them - or a new customer is added. Nothing
 * without a phone or an email.
 * @param {{ name, phone, email, address }} customer - address: what checkAddress stored
 * @returns {Promise<ObjectId|null>} The customer's id
 */
const saveFromJobOrder = async ({ vendorId, userId, customer, isRetry = false }) => {
    try {
        const { name, phone, email, address } = customer;
        if (!phone && !email) return null;
        const found = await Customer.find({ vendorId, status: LIVE, $or: [phone && { phone }, email && { email }].filter(Boolean) }).select('_id phone email').lean();
        const byPhone = phone ? found.find((c) => c.phone === phone) : null;
        const byEmail = email ? found.find((c) => c.email === email) : null;
        const match = byPhone || byEmail;
        const now = new Date();

        if (!match) {
            try {
                const created = await Customer.create({ vendorId, name, phone, email, ...(hasAddress(address) && { address }), lastJobOrderAt: now });
                return created._id;
            } catch (err) {
                // Saved at the same moment by another job order: update that one.
                if (err?.code === 11000 && !isRetry) return await saveFromJobOrder({ vendorId, userId, customer, isRetry: true });
                throw err;
            }
        }

        const isMine = (other) => !other || idOf(other._id) === idOf(match._id);
        const set = { lastJobOrderAt: now };
        if (name) set.name = name;
        if (phone && isMine(byPhone)) set.phone = phone;
        if (email && isMine(byEmail)) set.email = email;
        if (hasAddress(address)) set.address = address;
        try {
            await Customer.findOneAndUpdate({ _id: match._id, vendorId, status: LIVE }, { $set: set }, { auditUserId: userId, projection: { _id: 1 } }).lean();
        } catch (err) {
            // A phone / email taken by another customer at the same moment: keep theirs.
            if (err?.code !== 11000) throw err;
        }
        return match._id;
    } catch (err) {
        throw err;
    }
};

// GET /api/customers/for-job-order - the job order form's search.
const searchForJobOrder = async ({ vendorId, search }) => {
    try {
        const customers = search
            ? await Customer.find({ vendorId, status: LIVE, ...searchFilterOf(search) }).select(FIELDS).sort({ lastJobOrderAt: -1, _id: -1 }).limit(CUSTOMER_SEARCH_RESULTS).lean()
            : [];
        return common.returnResult(true, 200, 'Customers fetched successfully.', { customers });
    } catch (err) {
        throw err;
    }
};

// ---- the Customers module -----------------------------------------------------

// GET /api/customers/form-data - the countries for the address.
const getFormData = async ({ companyMasterData }) => {
    try {
        return common.returnResult(true, 200, 'Customer form fetched successfully.', { countries: await countriesOf(companyMasterData) });
    } catch (err) {
        throw err;
    }
};

// GET /api/customers - the latest job order first; search any part of the
// name, phone, email or address. Each with how many job orders name it.
const listCustomers = async ({ vendorId, search, page, limit }) => {
    try {
        const filter = { vendorId, status: LIVE, ...(search && searchFilterOf(search)) };
        const [total, customers] = await Promise.all([
            Customer.countDocuments(filter),
            Customer.find(filter).select(FIELDS).sort({ lastJobOrderAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean()
        ]);
        const counts = customers.length === 0 ? [] : await JobOrder.aggregate([
            { $match: { vendorId: new mongoose.Types.ObjectId(idOf(vendorId)), status: LIVE, customerId: { $in: customers.map((c) => c._id) } } },
            { $group: { _id: '$customerId', count: { $sum: 1 } } }
        ]);
        const countById = new Map(counts.map((row) => [idOf(row._id), row.count]));
        return common.returnResult(true, 200, 'Customers fetched successfully.', {
            customers: customers.map((customer) => ({ ...customer, jobOrderCount: countById.get(idOf(customer._id)) || 0 })),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        });
    } catch (err) {
        throw err;
    }
};

// GET /api/customers/:id
const getCustomer = async ({ vendorId, id }) => {
    try {
        const customer = await Customer.findOne({ _id: id, vendorId, status: LIVE }).select(FIELDS).lean();
        if (!customer) return common.returnResult(false, 404, 'Customer not found.');
        return common.returnResult(true, 200, 'Customer fetched successfully.', { customer });
    } catch (err) {
        throw err;
    }
};

// PUT /api/customers/:id - a phone or an email stays required (they tell
// customers apart), each unique among the vendor's customers. Old job orders
// keep the details they were saved with.
const updateCustomer = async ({ vendorId, userId, id, data, companyMasterData }) => {
    try {
        const errors = [];
        if (!data.phone && !data.email) {
            const message = 'Enter a phone or an email';
            errors.push({ field: 'phone', message }, { field: 'email', message });
        }
        const address = checkAddress(await countriesOf(companyMasterData), data.address, 'address');
        errors.push(...address.errors);
        if (errors.length > 0) return common.returnResult(false, 400, errors[0].message, { errors });

        let customer;
        try {
            customer = await Customer.findOneAndUpdate(
                { _id: id, vendorId, status: LIVE },
                { $set: { name: data.name, phone: data.phone, email: data.email, address: address.stored } },
                { returnDocument: 'after', runValidators: true, auditUserId: userId, projection: { _id: 1, name: 1, phone: 1, email: 1 } }
            ).lean();
        } catch (err) {
            const duplicate = duplicateResult(err);
            if (duplicate) return duplicate;
            throw err;
        }
        if (!customer) return common.returnResult(false, 404, 'Customer not found.');
        return common.returnResult(true, 200, 'Customer saved.', { customer });
    } catch (err) {
        throw err;
    }
};

// DELETE /api/customers/:id - soft delete; their job orders stay as they
// are. A later job order with their phone or email saves them again.
const deleteCustomer = async ({ vendorId, userId, id }) => {
    try {
        const result = await common.softDelete(Customer, id, userId, vendorId);
        if (!result.isSuccess) return result.statusCode === 404 ? common.returnResult(false, 404, 'Customer not found.') : result;
        return common.returnResult(true, 200, 'Customer deleted.');
    } catch (err) {
        throw err;
    }
};

// POST /api/customers/bulk - delete several; meta.results says how each went.
const bulkDeleteCustomers = async ({ vendorId, userId, ids }) => {
    try {
        return await common.runBulkOperation(ids, (id) => deleteCustomer({ vendorId, userId, id }));
    } catch (err) {
        throw err;
    }
};

module.exports = {
    checkAddress,
    saveFromJobOrder,
    searchForJobOrder,
    getFormData,
    listCustomers,
    getCustomer,
    updateCustomer,
    deleteCustomer,
    bulkDeleteCustomers
};
