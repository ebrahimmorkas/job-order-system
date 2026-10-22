const CountryMaster = require('../models/CountryMaster');
const CurrencyMaster = require('../models/CurrencyMaster');
const StateMaster = require('../models/StateMaster');
const CityMaster = require('../models/CityMaster');
const TaxMaster = require('../models/TaxMaster');
const CompanySettings = require('../models/CompanySettings');
const common = require('../utils/common');
const { FEATURE_FLAGS } = require('../constants/featureConstants');

// Company Settings > Tax: the vendor's business in each of its countries
// (CompanyMaster.assignedCountries) - the address there and the tax
// registration - and which countries tax can be charged in.
//
// A country is "tax ready" when the tax feature is on, the country is
// assigned and the vendor saved it as registered for tax (saving checks the
// address and the country's required tax fields then). Only then is tax
// charged on a job order of that country.

const COUNTRY_FIELDS = '_id name code phoneCode currencyId taxName taxFields postalCode';

// The vendor's assigned countries, as id strings.
const assignedCountryIdsOf = (companyMasterData) => (companyMasterData?.assignedCountries || []).map(String);

// The tax feature is on for the vendor (both switches) and it has a country.
const isTaxOn = (websiteMasterData, companyMasterData) =>
    websiteMasterData?.[FEATURE_FLAGS.TAX] === true && companyMasterData?.[FEATURE_FLAGS.TAX] === true
    && assignedCountryIdsOf(companyMasterData).length > 0;

const isDetailReady = (detail) => detail?.isTaxRegistered === true;

// The assigned countries the vendor can charge tax in (id strings).
const taxReadyCountryIds = (websiteMasterData, companyMasterData, companySettingsData) => {
    try {
        if (!isTaxOn(websiteMasterData, companyMasterData)) return [];
        const assigned = new Set(assignedCountryIdsOf(companyMasterData));
        return (companySettingsData?.taxDetails || [])
            .filter((detail) => assigned.has(String(detail.countryId)) && isDetailReady(detail))
            .map((detail) => String(detail.countryId));
    } catch (err) {
        throw err;
    }
};

// The rates in force today (from <= now, and no end date or one still ahead).
const currentTaxFilter = (countryIds) => {
    const now = new Date();
    return {
        countryId: { $in: countryIds },
        status: 'A',
        applicableFrom: { $lte: now },
        $or: [{ applicableTo: null }, { applicableTo: { $gt: now } }]
    };
};

// The saved details of one country in the shape the Tax tab uses.
const toDetailView = (detail) => ({
    address: {
        line1: detail?.address?.line1 ?? null,
        line2: detail?.address?.line2 ?? null,
        stateId: detail?.address?.stateId ?? null,
        cityId: detail?.address?.cityId ?? null,
        postalCode: detail?.address?.postalCode ?? null
    },
    isTaxRegistered: detail?.isTaxRegistered === true,
    taxFieldValues: detail?.taxFieldValues || {},
    defaultTaxId: detail?.defaultTaxId ?? null
});

// GET /api/company-settings/tax - every assigned country with what its form
// needs (tax fields, postal code rules, states, cities, current rates,
// currency) and what the vendor saved for it.
const getTaxSettings = async ({ companyMasterData, companySettingsData }) => {
    try {
        const countryIds = assignedCountryIdsOf(companyMasterData);
        const [countries, states, cities, taxes] = await Promise.all([
            CountryMaster.find({ _id: { $in: countryIds }, status: 'A' }).select(COUNTRY_FIELDS).sort({ precedence: 1, name: 1 }).lean(),
            StateMaster.find({ countryId: { $in: countryIds }, status: 'A' }).select('_id countryId name code taxCode').sort({ name: 1 }).lean(),
            CityMaster.find({ countryId: { $in: countryIds }, status: 'A' }).select('_id countryId stateId name').sort({ name: 1 }).lean(),
            TaxMaster.find(currentTaxFilter(countryIds)).select('_id countryId name totalRate components isDefault').sort({ precedence: 1 }).lean()
        ]);
        const currencies = await CurrencyMaster.find({ _id: { $in: countries.map((c) => c.currencyId) } }).select('_id code symbol decimalPlaces').lean();

        const byCountry = (rows) => {
            const map = new Map();
            for (const { countryId, ...row } of rows) {
                const key = String(countryId);
                if (!map.has(key)) map.set(key, []);
                map.get(key).push(row);
            }
            return map;
        };
        const statesOf = byCountry(states);
        const citiesOf = byCountry(cities);
        const taxesOf = byCountry(taxes);
        const currencyById = new Map(currencies.map(({ _id, ...currency }) => [String(_id), currency]));
        const detailOf = new Map((companySettingsData?.taxDetails || []).map((detail) => [String(detail.countryId), detail]));

        return common.returnResult(true, 200, 'Tax settings fetched successfully.', {
            countries: countries.map(({ currencyId, ...country }) => {
                const key = String(country._id);
                return {
                    ...country,
                    currency: currencyById.get(String(currencyId)) || null,
                    states: statesOf.get(key) || [],
                    cities: citiesOf.get(key) || [],
                    taxes: taxesOf.get(key) || [],
                    details: toDetailView(detailOf.get(key)),
                    isTaxReady: isDetailReady(detailOf.get(key))
                };
            })
        });
    } catch (err) {
        throw err;
    }
};

const matches = (pattern, value) => !pattern || new RegExp(pattern).test(value);

// The country's own rules for the details (they can't be in the Joi schema):
// the field errors as { field, message }, and the details to store.
const checkDetails = ({ country, data, state, city, tax }) => {
    try {
        const errors = [];
        const add = (field, message) => errors.push({ field, message });
        const address = data.address;
        const registered = data.isTaxRegistered;

        if (address.stateId && !state) add('address.stateId', 'Choose a state of this country');
        if (address.cityId && !city) add('address.cityId', 'Choose a city of the chosen state');
        if (address.cityId && !address.stateId) add('address.stateId', 'Choose the state of the city');
        const postal = country.postalCode || {};
        if (address.postalCode && !matches(postal.pattern, address.postalCode)) {
            add('address.postalCode', postal.patternMessage || `Enter a valid ${postal.label || 'postal code'}`);
        }
        if (registered) {
            if (!address.line1) add('address.line1', 'Enter the address');
            if (!address.stateId) add('address.stateId', 'Choose the state');
            if (!address.cityId) add('address.cityId', 'Choose the city');
            if (postal.isRequired && !address.postalCode) add('address.postalCode', `Enter the ${postal.label || 'postal code'}`);
        }

        // Only the country's own fields are kept, in capital letters.
        const taxFieldValues = {};
        for (const field of country.taxFields || []) {
            const value = (data.taxFieldValues?.[field.key] || '').trim().toUpperCase();
            const name = `taxFieldValues.${field.key}`;
            if (!value) {
                if (registered && field.isRequired) add(name, `Enter the ${field.label}`);
                continue;
            }
            if (field.maxLength && value.length > field.maxLength) add(name, `The ${field.label} can be at most ${field.maxLength} characters`);
            else if (!matches(field.pattern, value)) add(name, field.patternMessage || `Enter a valid ${field.label}`);
            else if (field.startsWithStateTaxCode && state?.taxCode && !value.startsWith(state.taxCode)) {
                add(name, `The ${field.label} of a business in ${state.name} starts with ${state.taxCode}`);
            }
            taxFieldValues[field.key] = value;
        }

        if (data.defaultTaxId && !tax) add('defaultTaxId', 'Choose one of the rates of this country');

        return {
            errors,
            detail: {
                countryId: country._id,
                address: {
                    line1: address.line1,
                    line2: address.line2,
                    stateId: address.stateId,
                    cityId: address.cityId,
                    postalCode: address.postalCode
                },
                isTaxRegistered: registered,
                taxFieldValues,
                defaultTaxId: data.defaultTaxId
            }
        };
    } catch (err) {
        throw err;
    }
};

// PUT /api/company-settings/tax/:countryId - saves one country's details.
const updateTaxDetails = async ({ vendorId, userId, countryId, data, companyMasterData }) => {
    try {
        if (!assignedCountryIdsOf(companyMasterData).includes(countryId)) {
            return common.returnResult(false, 404, 'This country is not assigned to your account.');
        }
        const { stateId, cityId } = data.address;
        const [country, state, city, tax] = await Promise.all([
            CountryMaster.findOne({ _id: countryId, status: 'A' }).select('_id taxFields postalCode').lean(),
            stateId ? StateMaster.findOne({ _id: stateId, countryId, status: 'A' }).select('_id name taxCode').lean() : null,
            cityId && stateId ? CityMaster.findOne({ _id: cityId, stateId, status: 'A' }).select('_id').lean() : null,
            data.defaultTaxId ? TaxMaster.findOne({ ...currentTaxFilter([countryId]), _id: data.defaultTaxId }).select('_id').lean() : null
        ]);
        if (!country) return common.returnResult(false, 404, 'This country is not available.');

        const { errors, detail } = checkDetails({ country, data, state, city, tax });
        if (errors.length > 0) return common.returnResult(false, 400, errors[0].message, { errors });

        // Replace this country's entry, or add it. The $ne guard keeps two
        // saves at once from adding it twice.
        const replaced = await CompanySettings.updateOne(
            { vendorId, 'taxDetails.countryId': countryId },
            { $set: { 'taxDetails.$': detail } },
            { runValidators: true, auditUserId: userId }
        );
        if (replaced.matchedCount === 0) {
            const added = await CompanySettings.updateOne(
                { vendorId, 'taxDetails.countryId': { $ne: countryId } },
                { $push: { taxDetails: detail } },
                { runValidators: true, auditUserId: userId }
            );
            if (added.matchedCount === 0) return common.returnResult(false, 404, 'Company settings have not been set up yet.');
        }

        return common.returnResult(true, 200, 'Tax details saved.', {
            details: toDetailView(detail),
            isTaxReady: isDetailReady(detail)
        });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    assignedCountryIdsOf,
    isTaxOn,
    taxReadyCountryIds,
    getTaxSettings,
    updateTaxDetails
};
