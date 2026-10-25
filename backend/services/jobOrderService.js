const JobOrder = require('../models/JobOrder');
const Counter = require('../models/Counter');
const common = require('../utils/common');
const logger = require('../utils/logger');
const { computeTotals } = require('../utils/jobOrderTotals');
const masterService = require('./masterService');
const controlService = require('./controlService');
const featureAccessService = require('./featureAccessService');
const imageUploadService = require('./imageUploadService');
const workAssignmentService = require('./workAssignmentService');
const stepService = require('./stepService');
const notificationService = require('./notificationService');
const customerService = require('./customerService');
const { jobOrderSettingsOf } = require('./companySettingsService');
const { assignedCountryIdsOf, isTaxOn, taxReadyCountryIds, loadCountries, detailsByCountry } = require('./taxSettingsService');
const { LIVE_STATUSES, CASE_INSENSITIVE_COLLATION } = require('../constants/masterConstants');
const { CONTROL_TYPES, PRICE_PATTERN } = require('../constants/controlConstants');
const { SHORT_NAME_PLACES, AUTO_NUMBER_PREFIX, AUTO_NUMBER_DIGITS, ANSWER_MAX_LENGTH } = require('../constants/jobOrderConstants');
const { addDuration } = require('../utils/days');
const { WORK_TIME_STARTS, WORK_TIME_CHANGE_FROM, FIXED_STEPS } = require('../constants/stepConstants');
const { FEATURE_FLAGS } = require('../constants/featureConstants');
const { IMAGE_FORMATS, IMAGE_FORMAT_VALUES, IMAGE_MODULES, MAX_IMAGES_PER_REQUEST } = require('../constants/storageConstants');

// The vendor's job orders. A job order is the masters picked and controls
// answered on the job order form, the customer's address (when asked) and
// the money: every price, the tax and the total. Everything is checked and
// worked out here from the current masters, controls, countries and rates -
// whatever the browser shows is only a preview - and names are copied in.
//
// Tax country: the customer's country, or the vendor's only country. Tax is
// charged only on prices marked "Include this price in tax", and only in a
// country the vendor is registered in (tax ready).
//
// Images come as files with Create / Save. Every file is checked before any
// is stored; if storing or saving fails, the files stored for it are removed
// again, and images taken off a job order are removed once it is saved.
//
// Work: each picked value of a role master can be given to people who have
// that value (see workAssignmentService). On edit, people already given a
// value may stay even if they no longer have it.

const LIVE = { $in: LIVE_STATUSES };
const LIST_FIELDS = '_id jobOrderNumber customer.name customer.phone customer.countryName customer.stateName customer.cityName currency subtotal tax.isApplied tax.amount total createdAt updatedAt masters.values.assignedTo.step.fixedStep';
const COUNTER_KEY = 'jobOrder';

const idOf = (value) => (value ? String(value) : null);

// ---- images -----------------------------------------------------------------

// What the vendor may add: on in WebsiteMaster AND CompanyMaster; a null
// limit = up to the server's own ceiling.
const imageRulesOf = (websiteMasterData, companyMasterData) => {
    try {
        const flag = FEATURE_FLAGS.IMAGE_UPLOAD;
        // Always in the same order (JPG, PNG, WebP, GIF), whatever order they were set in.
        const own = companyMasterData?.imageFormatsAllowed;
        const formats = own?.length > 0 ? IMAGE_FORMAT_VALUES.filter((format) => own.includes(format)) : IMAGE_FORMAT_VALUES;
        return {
            isOn: websiteMasterData?.[flag] === true && companyMasterData?.[flag] === true,
            maxCount: Math.min(companyMasterData?.numberOfImageUploadAllowed ?? MAX_IMAGES_PER_REQUEST, MAX_IMAGES_PER_REQUEST),
            maxSizeMB: imageUploadService.maxImageSizeMBOf(companyMasterData),
            formats,
            mimeTypes: formats.map((format) => IMAGE_FORMATS[format].mimeType)
        };
    } catch (err) {
        throw err;
    }
};

// Field errors ('images') for new files, before anything is stored.
const checkImages = ({ rules, files, keptCount, companyMasterData }) => {
    try {
        if (files.length === 0) return [];
        if (!rules.isOn) return [{ field: 'images', message: 'Adding images is not available for your account.' }];
        const errors = [];
        if (keptCount + files.length > rules.maxCount) {
            errors.push({ field: 'images', message: `At most ${rules.maxCount} ${rules.maxCount === 1 ? 'image' : 'images'} per job order.` });
        }
        for (const file of files) {
            const check = imageUploadService.validateImage(file, companyMasterData, { allowedMimeTypes: rules.mimeTypes });
            if (!check.isSuccess) errors.push({ field: 'images', message: `${file.originalname.slice(0, 80)}: ${check.message}` });
        }
        return errors;
    } catch (err) {
        throw err;
    }
};

// Removes stored images; a failure is logged, never fatal (the job order is
// already right without them).
const removeImages = async ({ vendorId, userId, images }) => {
    try {
        const results = await Promise.allSettled(images.map((image) => imageUploadService.deleteImage({ vendorId, userId, imageId: image.imageId })));
        results.forEach((result, index) => {
            if (result.status === 'rejected') logger.logWarning('Could not remove a job order image', { error: result.reason, vendorId, imageId: String(images[index].imageId) });
        });
    } catch (err) {
        throw err;
    }
};

// Stores the new files together. { images } or { failure } (a result to
// return; whatever was stored is removed again). Throws like any service.
const storeImages = async ({ vendorId, userId, files, rules, companyMasterData, websiteMasterData }) => {
    try {
        const results = await Promise.allSettled(files.map((file) => imageUploadService.uploadImage({
            vendorId, userId, module: IMAGE_MODULES.JOB_ORDER, file, companyMasterData, websiteMasterData, allowedMimeTypes: rules.mimeTypes
        })));
        const images = results
            .filter((result) => result.status === 'fulfilled' && result.value.isSuccess)
            .map(({ value }) => ({ imageId: value.meta.image._id, url: value.meta.image.url }));
        if (images.length === files.length) return { images };

        await removeImages({ vendorId, userId, images });
        const thrown = results.find((result) => result.status === 'rejected');
        if (thrown) throw thrown.reason;
        return { failure: results.find((result) => !result.value.isSuccess).value };
    } catch (err) {
        throw err;
    }
};

// ---- what the form needs ----------------------------------------------------

// The masters and controls the job order gets (each only while its feature
// - or its "fetch even when off" switch - allows), the vendor's countries
// with their states, cities, rates and currency, and the job order settings.
const loadFormParts = async ({ vendorId, websiteMasterData, companyMasterData, companySettingsData }) => {
    try {
        const access = featureAccessService.getFeatureAccess(websiteMasterData, companyMasterData).meta.featureAccess;
        const [mastersResult, controlsResult, countries] = await Promise.all([
            access.canFetchMastersForJobOrder ? masterService.getMastersForJobOrder({ vendorId }) : null,
            access.canFetchControlsForJobOrder ? controlService.getControlsForJobOrder({ vendorId, companyMasterData }) : null,
            loadCountries(assignedCountryIdsOf(companyMasterData))
        ]);

        const taxOn = isTaxOn(websiteMasterData, companyMasterData);
        const ready = new Set(taxReadyCountryIds(websiteMasterData, companyMasterData, companySettingsData));
        const detailOf = detailsByCountry(companySettingsData);
        const settings = jobOrderSettingsOf(companySettingsData);

        const imageRules = imageRulesOf(websiteMasterData, companyMasterData);
        const masters = mastersResult?.meta.masters || [];
        const work = await workAssignmentService.workersOf({ vendorId, masters, websiteMasterData, companyMasterData });
        return {
            isTaxOn: taxOn,
            images: { isOn: imageRules.isOn, maxCount: imageRules.maxCount, maxSizeMB: imageRules.maxSizeMB, formats: imageRules.formats },
            settings: {
                ...settings,
                useShortNames: [SHORT_NAME_PLACES.JOB_ORDER, SHORT_NAME_PLACES.BOTH].includes(settings.useShortNamesOn),
                // Name, phone and email asked (and the customer saved): the Customers feature.
                askCustomerContact: access[FEATURE_FLAGS.CUSTOMERS] === true,
                // What newly given work's time starts on (steps off = when given).
                workTimeStartsOn: stepService.workTimeStartsOnOf(websiteMasterData, companyMasterData, companySettingsData)
            },
            // Each value of a role master lists who can be given its work.
            masters: masters.map((master) => (master.isRoleProvided
                ? { ...master, values: master.values.map((value) => ({ ...value, workerIds: [...(work.byValue.get(String(value._id)) || [])] })) }
                : master)),
            workers: work.workers,
            canAssignWork: work.workers.length > 0,
            controls: controlsResult?.meta.controls || [],
            countries: countries.map(({ taxFields, ...country }) => {
                const key = String(country._id);
                const detail = detailOf.get(key);
                const own = detail?.defaultTaxId && country.taxes.find((tax) => String(tax._id) === String(detail.defaultTaxId));
                const preset = own || country.taxes.find((tax) => tax.isDefault) || null;
                return {
                    ...country,
                    isTaxReady: ready.has(key),
                    defaultTaxId: preset?._id ?? null,
                    // The business's state there (an Indian sale to another state is IGST).
                    businessStateId: detail?.address?.stateId ?? null
                };
            })
        };
    } catch (err) {
        throw err;
    }
};

// GET /api/job-orders/form-data
const getFormData = async (vendorData) => {
    try {
        return common.returnResult(true, 200, 'Job order form fetched successfully.', await loadFormParts(vendorData));
    } catch (err) {
        throw err;
    }
};

// ---- building a job order ---------------------------------------------------

// Who a picked value's work goes to: [{ userId, name, startedAt, step, history }],
// or a message. previous: the values as saved before (on edit) - their people
// may stay, and everyone keeps how far they got.
const assigneesOf = ({ master, value, userIds, workerById, previous }) => {
    try {
        if (userIds.length > 0 && !master.isRoleProvided) return { message: `Work can't be given for ${master.name}.` };
        const before = new Map((previous.get(String(value._id))?.assignedTo || []).map((person) => [String(person.userId), person]));
        const assignees = [];
        for (const userId of userIds) {
            const worker = (value.workerIds || []).includes(userId) && workerById.get(userId);
            const kept = !worker && before.get(userId);
            if (!worker && !kept) return { message: `Someone picked for ${value.name} doesn't have it any more. Please pick again.` };
            const progress = before.get(userId);
            assignees.push({
                ...(worker ? { userId: worker._id, name: worker.name } : { userId: kept.userId, name: kept.name }),
                startedAt: progress?.startedAt ?? null,
                dueAt: progress?.dueAt ?? null,
                step: progress?.step ?? null,
                history: progress?.history ?? []
            });
        }
        return { assignees };
    } catch (err) {
        throw err;
    }
};

const sameDuration = (a, b) => (a?.amount ?? null) === (b?.amount ?? null) && (a?.unit ?? null) === (b?.unit ?? null);

// When a value's work was given and is due. The clock starts when people are
// first given it and restarts only when completeIn changes - then on what
// timeStartsOn says today. onAssign: one dueAt for everyone; onFirstStep:
// each person's own, from their first step (none before it). A changed time
// of someone who already started counts from their start or from now
// (changeCountsFrom); an unchanged one keeps their due time.
// before: the value as saved before (on edit), or undefined.
const personDueAt = ({ person, completeIn, isSameClock, changeCountsFrom, now }) => {
    try {
        if (!person.startedAt) return null;
        if (isSameClock && person.dueAt) return person.dueAt;
        return addDuration(!isSameClock && changeCountsFrom === WORK_TIME_CHANGE_FROM.CHANGE ? now : person.startedAt, completeIn);
    } catch (err) {
        throw err;
    }
};

const timingOf = ({ assignees, completeIn, before, now, timeStartsOn, changeCountsFrom }) => {
    try {
        if (assignees.length === 0) return { assignedTo: assignees, assignedAt: null, completeIn: null, dueAt: null, timeStartsOn: WORK_TIME_STARTS.ON_ASSIGN };
        const isSameClock = before?.assignedAt && before.assignedTo?.length > 0 && sameDuration(before.completeIn, completeIn);
        const assignedAt = isSameClock ? before.assignedAt : now;
        const startsOn = isSameClock ? (before.timeStartsOn || WORK_TIME_STARTS.ON_ASSIGN) : timeStartsOn;
        const perPerson = startsOn === WORK_TIME_STARTS.ON_FIRST_STEP && !!completeIn;
        return {
            assignedTo: assignees.map((person) => ({ ...person, dueAt: perPerson ? personDueAt({ person, completeIn, isSameClock, changeCountsFrom, now }) : null })),
            assignedAt,
            completeIn: completeIn || null,
            dueAt: completeIn && !perPerson ? addDuration(assignedAt, completeIn) : null,
            timeStartsOn: startsOn
        };
    } catch (err) {
        throw err;
    }
};

// The masters picked: field errors by master, and what to store.
// previous: valueId -> the value as saved before (on edit).
const pickMasters = (masters, input, workers, previous, { workTimeStartsOn: timeStartsOn, workTimeChangeCountsFrom: changeCountsFrom }) => {
    try {
        const errors = [];
        const now = new Date();
        const picked = new Map(input.map((entry) => [entry.masterId, entry.valueIds]));
        const assignmentsOf = new Map(input.map((entry) => [entry.masterId, entry.assignments || []]));
        const workerById = new Map(workers.map((worker) => [String(worker._id), worker]));
        const known = new Set(masters.map((master) => String(master._id)));
        for (const masterId of picked.keys()) {
            if (!known.has(masterId)) errors.push({ field: `masters.${masterId}`, message: 'This list is no longer available. Please reload the page.' });
        }

        const stored = [];
        for (const master of masters) {
            const masterId = String(master._id);
            const field = `masters.${masterId}`;
            const valueIds = picked.get(masterId) || [];
            const valueById = new Map(master.values.map((value) => [String(value._id), value]));
            if (valueIds.some((valueId) => !valueById.has(valueId))) {
                errors.push({ field, message: 'A value picked here is no longer available. Please pick again.' });
                continue;
            }
            if (!master.isMultiselectAllowed && valueIds.length > 1) {
                errors.push({ field, message: `Pick only one ${master.name}` });
                continue;
            }
            if (master.isRequired && valueIds.length === 0) {
                errors.push({ field, message: `Pick a ${master.name}` });
                continue;
            }
            const assignments = assignmentsOf.get(masterId) || [];
            if (assignments.some((assignment) => !valueIds.includes(assignment.valueId))) {
                errors.push({ field, message: 'Work can be given only for a value picked here.' });
                continue;
            }
            const assignmentOf = new Map(assignments.map((assignment) => [assignment.valueId, assignment]));
            const values = [];
            let message = null;
            for (const valueId of valueIds) {
                const value = valueById.get(valueId);
                const assignment = assignmentOf.get(valueId);
                const result = assigneesOf({ master, value, userIds: assignment?.userIds || [], workerById, previous });
                if (result.message) {
                    message = result.message;
                    break;
                }
                const timing = timingOf({ assignees: result.assignees, completeIn: assignment?.completeIn, before: previous.get(valueId), now, timeStartsOn, changeCountsFrom });
                values.push({ valueId: value._id, name: value.name, ...timing });
            }
            if (message) {
                errors.push({ field, message });
                continue;
            }
            if (valueIds.length === 0) continue;
            stored.push({
                masterId: master._id,
                name: master.name,
                shortName: master.shortName || null,
                values
            });
        }
        return { errors, stored };
    } catch (err) {
        throw err;
    }
};

// The controls answered: field errors by control, and what to store.
const answerControls = (controls, input) => {
    try {
        const errors = [];
        const answers = new Map(input.map((entry) => [entry.controlId, entry]));
        const known = new Set(controls.map((control) => String(control._id)));
        for (const controlId of answers.keys()) {
            if (!known.has(controlId)) errors.push({ field: `controls.${controlId}`, message: 'This field is no longer available. Please reload the page.' });
        }

        const stored = [];
        for (const control of controls) {
            const controlId = String(control._id);
            const field = `controls.${controlId}`;
            const answer = answers.get(controlId) || {};
            const base = { controlId: control._id, type: control.type, label: control.label };

            if (control.type === CONTROL_TYPES.CHECKBOX) {
                const checked = answer.checked === true;
                if (control.isRequired && !checked) errors.push({ field, message: 'This must be ticked' });
                stored.push({ ...base, checked });
                continue;
            }
            if (control.type === CONTROL_TYPES.RADIO) {
                const option = answer.optionId ? control.options.find((o) => String(o._id) === answer.optionId) : null;
                if (answer.optionId && !option) errors.push({ field, message: 'This choice is no longer available. Please pick again.' });
                else if (control.isRequired && !option) errors.push({ field, message: 'Pick one' });
                if (option) stored.push({ ...base, optionId: option._id, optionName: option.name });
                continue;
            }

            // Text field / text area.
            const text = (control.isPrice ? (answer.text || '').trim() : answer.text || '') || null;
            const max = control.maxLength ?? ANSWER_MAX_LENGTH;
            if (!text) {
                if (control.isRequired) errors.push({ field, message: control.isPrice ? 'Enter the amount' : 'This is required' });
                continue;
            }
            if (text.length > max) {
                errors.push({ field, message: `At most ${max} characters` });
                continue;
            }
            if (control.isPrice) {
                if (!PRICE_PATTERN.test(text)) {
                    errors.push({ field, message: 'Enter an amount with at most 2 decimals, e.g. 150 or 150.50' });
                    continue;
                }
                stored.push({ ...base, text, isPrice: true, isPriceIncludedInTax: control.isPriceIncludedInTax === true, amount: Number(text) });
                continue;
            }
            stored.push({ ...base, text });
        }
        return { errors, stored };
    } catch (err) {
        throw err;
    }
};

// The customer: name, phone and email (Customers feature on) and the address
// (when asked - customerService.checkAddress). Field errors and what to store.
const customerOf = (parts, input) => {
    try {
        const address = parts.settings.askCustomerAddress
            ? customerService.checkAddress(parts.countries, input, 'customer')
            : { errors: [], stored: {} };
        const contact = parts.settings.askCustomerContact ? { name: input.name, phone: input.phone, email: input.email } : {};
        return { errors: address.errors, stored: { ...contact, ...address.stored } };
    } catch (err) {
        throw err;
    }
};

// The saved customer of a job order about to be saved (Customers feature on).
const savedCustomerIdOf = async ({ vendorId, userId, parts, customer }) => {
    try {
        if (!parts.settings.askCustomerContact) return null;
        const { name, phone, email, ...address } = customer;
        return await customerService.saveFromJobOrder({ vendorId, userId, customer: { name, phone, email, address } });
    } catch (err) {
        throw err;
    }
};

// The tax and totals of the prices, for the tax country.
const workOutMoney = ({ parts, prices, taxCountry, customerStateId, taxId }) => {
    try {
        const errors = [];
        const hasTaxedPrice = prices.some((price) => price.isTaxed);
        const tax = { isApplied: false, reason: null, countryId: taxCountry?._id ?? null, countryName: taxCountry?.name ?? null };
        let rate = null;

        if (parts.isTaxOn && hasTaxedPrice) {
            if (!taxCountry) {
                tax.reason = parts.settings.askCustomerAddress
                    ? 'Choose the customer country to charge tax.'
                    : 'No tax is charged: you have more than one country and the customer address is not asked. Turn on "Ask the customer address" in Company Settings.';
            } else if (!taxCountry.isTaxReady) {
                tax.reason = `You are not registered for ${taxCountry.taxName} in ${taxCountry.name}, so no tax is charged.`;
            } else {
                rate = taxId ? taxCountry.taxes.find((t) => String(t._id) === taxId) : taxCountry.taxes.find((t) => idOf(t._id) === idOf(taxCountry.defaultTaxId));
                if (taxId && !rate) errors.push({ field: 'taxId', message: 'Choose one of the rates of this country' });
                else if (!rate) tax.reason = `No tax rate is available for ${taxCountry.name}.`;
            }
        }

        // Between two states (e.g. IGST in India). An unknown customer state
        // counts as the business's own state.
        const businessStateId = idOf(taxCountry?.businessStateId);
        const isInterState = !!(rate && taxCountry.interStateTaxLabel && customerStateId && businessStateId && customerStateId !== businessStateId);
        const totals = computeTotals({
            prices: prices.map((price) => ({ amount: price.amount, isTaxed: price.isTaxed })),
            tax: rate,
            decimals: taxCountry?.currency?.decimalPlaces ?? 2,
            interStateLabel: isInterState ? taxCountry.interStateTaxLabel : null
        });
        if (rate) {
            Object.assign(tax, {
                isApplied: true, taxId: rate._id, name: rate.name, totalRate: rate.totalRate, components: totals.components,
                taxableAmount: totals.taxableAmount, amount: totals.taxAmount
            });
        }
        return {
            errors,
            stored: {
                currency: taxCountry?.currency ? { ...taxCountry.currency } : { code: null, symbol: null, decimalPlaces: 2 },
                subtotal: totals.subtotal,
                tax,
                total: totals.total
            }
        };
    } catch (err) {
        throw err;
    }
};

// Everything checked and worked out: { errors } or { doc } (without the number).
// current: the job order being edited (its masters), or null.
const buildJobOrder = (parts, data, current = null) => {
    try {
        const previous = new Map();
        for (const master of current?.masters || []) {
            for (const value of master.values) previous.set(String(value.valueId), value);
        }
        const masters = pickMasters(parts.masters, data.masters, parts.workers, previous, parts.settings);
        const controls = answerControls(parts.controls, data.controls);
        const customer = customerOf(parts, data.customer);

        const countryId = customer.stored.countryId ? String(customer.stored.countryId) : (parts.countries.length === 1 ? String(parts.countries[0]._id) : null);
        const taxCountry = countryId ? parts.countries.find((c) => String(c._id) === countryId) : null;
        const prices = controls.stored.filter((c) => c.isPrice).map((c) => ({ amount: c.amount, isTaxed: c.isPriceIncludedInTax }));
        const money = workOutMoney({ parts, prices, taxCountry, customerStateId: idOf(customer.stored.stateId), taxId: data.taxId });

        const errors = [...masters.errors, ...controls.errors, ...customer.errors, ...money.errors];
        if (errors.length > 0) return { errors };
        return { doc: { customer: customer.stored, masters: masters.stored, controls: controls.stored, ...money.stored } };
    } catch (err) {
        throw err;
    }
};

const invalid = (errors) => common.returnResult(false, 400, errors[0].message, { errors });

// A number already used by another job order of the vendor -> 409 on the field.
const duplicateResult = (err, number) => {
    try {
        if (err?.code !== 11000) return null;
        const message = `Job order number ${number} is already used.`;
        return common.returnResult(false, 409, message, { errors: [{ field: 'jobOrderNumber', message }] });
    } catch (error) {
        throw error;
    }
};

// The next automatic number, JO-0001... Numbers already typed by hand are skipped.
const nextJobOrderNumber = async (vendorId) => {
    try {
        for (;;) {
            const counter = await Counter.findOneAndUpdate(
                { vendorId, key: COUNTER_KEY },
                { $inc: { seq: 1 } },
                { upsert: true, returnDocument: 'after' }
            ).lean();
            const number = `${AUTO_NUMBER_PREFIX}${String(counter.seq).padStart(AUTO_NUMBER_DIGITS, '0')}`;
            const taken = await JobOrder.exists({ vendorId, jobOrderNumber: number, status: LIVE }).collation(CASE_INSENSITIVE_COLLATION);
            if (!taken) return number;
        }
    } catch (err) {
        throw err;
    }
};

// ---- job orders -------------------------------------------------------------

// POST /api/job-orders
const createJobOrder = async ({ userId, data, files = [], ...vendorData }) => {
    try {
        const { vendorId, websiteMasterData, companyMasterData } = vendorData;
        const parts = await loadFormParts(vendorData);
        const isAuto = parts.settings.isJobOrderNumberAutoGenerated;
        const rules = imageRulesOf(websiteMasterData, companyMasterData);
        const { errors, doc } = buildJobOrder(parts, data);
        const numberError = !isAuto && !data.jobOrderNumber ? [{ field: 'jobOrderNumber', message: 'Enter the job order number' }] : [];
        const imageErrors = checkImages({ rules, files, keptCount: 0, companyMasterData });
        if (numberError.length > 0 || errors || imageErrors.length > 0) return invalid([...numberError, ...(errors || []), ...imageErrors]);

        const stored = files.length > 0 ? await storeImages({ vendorId, userId, files, rules, companyMasterData, websiteMasterData }) : { images: [] };
        if (stored.failure) return stored.failure;

        doc.customerId = await savedCustomerIdOf({ vendorId, userId, parts, customer: doc.customer });
        let jobOrder;
        let jobOrderNumber = data.jobOrderNumber;
        try {
            if (isAuto) jobOrderNumber = await nextJobOrderNumber(vendorId);
            jobOrder = await JobOrder.create({ vendorId, jobOrderNumber, ...doc, images: stored.images });
        } catch (err) {
            await removeImages({ vendorId, userId, images: stored.images });
            const duplicate = duplicateResult(err, jobOrderNumber);
            if (duplicate) return duplicate;
            throw err;
        }
        notificationService.inBackground('Announcing a new job order failed', () => notificationService.announceJobOrderSaved({
            vendorId, jobOrderId: jobOrder._id, jobOrderNumber, after: doc.masters
        }));
        return common.returnResult(true, 201, `Job order ${jobOrderNumber} created.`, { jobOrder: { _id: jobOrder._id, jobOrderNumber } });
    } catch (err) {
        throw err;
    }
};

// PUT /api/job-orders/:id - everything worked out again from what is sent.
// An automatic number never changes; a typed one can.
const updateJobOrder = async ({ userId, id, data, files = [], ...vendorData }) => {
    try {
        const { vendorId, websiteMasterData, companyMasterData } = vendorData;
        const [current, parts] = await Promise.all([
            JobOrder.findOne({ _id: id, vendorId, status: LIVE }).select('jobOrderNumber images masters').lean(),
            loadFormParts(vendorData)
        ]);
        if (!current) return common.returnResult(false, 404, 'Job order not found.');

        // Images not listed in keepImageIds are taken off (also while the feature is off).
        const keep = new Set(data.keepImageIds);
        const kept = current.images.filter((image) => keep.has(String(image.imageId)));
        const removed = current.images.filter((image) => !keep.has(String(image.imageId)));

        const isAuto = parts.settings.isJobOrderNumberAutoGenerated;
        const rules = imageRulesOf(websiteMasterData, companyMasterData);
        const { errors, doc } = buildJobOrder(parts, data, current);
        const numberError = !isAuto && !data.jobOrderNumber ? [{ field: 'jobOrderNumber', message: 'Enter the job order number' }] : [];
        const imageErrors = checkImages({ rules, files, keptCount: kept.length, companyMasterData });
        if (numberError.length > 0 || errors || imageErrors.length > 0) return invalid([...numberError, ...(errors || []), ...imageErrors]);

        const stored = files.length > 0 ? await storeImages({ vendorId, userId, files, rules, companyMasterData, websiteMasterData }) : { images: [] };
        if (stored.failure) return stored.failure;

        doc.customerId = await savedCustomerIdOf({ vendorId, userId, parts, customer: doc.customer });
        const jobOrderNumber = isAuto ? current.jobOrderNumber : data.jobOrderNumber;
        let jobOrder;
        try {
            jobOrder = await JobOrder.findOneAndUpdate(
                { _id: id, vendorId, status: LIVE },
                { $set: { jobOrderNumber, ...doc, images: [...kept, ...stored.images] } },
                { returnDocument: 'after', runValidators: true, auditUserId: userId, projection: { _id: 1, jobOrderNumber: 1 } }
            ).lean();
        } catch (err) {
            await removeImages({ vendorId, userId, images: stored.images });
            const duplicate = duplicateResult(err, jobOrderNumber);
            if (duplicate) return duplicate;
            throw err;
        }
        if (!jobOrder) {
            await removeImages({ vendorId, userId, images: stored.images });
            return common.returnResult(false, 404, 'Job order not found.');
        }
        if (removed.length > 0) await removeImages({ vendorId, userId, images: removed });
        notificationService.inBackground('Announcing a saved job order failed', () => notificationService.announceJobOrderSaved({
            vendorId, jobOrderId: jobOrder._id, jobOrderNumber, before: current.masters, after: doc.masters
        }));
        return common.returnResult(true, 200, `Job order ${jobOrderNumber} saved.`, { jobOrder });
    } catch (err) {
        throw err;
    }
};

// How the work given on a job order is going, for the list: how many people
// were given work, how many completed it, are on hold or have started
// (null when nobody was given any).
const workSummaryOf = (masters = []) => {
    try {
        const summary = { people: 0, completed: 0, onHold: 0, started: 0 };
        for (const master of masters) {
            for (const value of master.values || []) {
                for (const person of value.assignedTo || []) {
                    summary.people++;
                    const fixedStep = person.step?.fixedStep;
                    if (fixedStep === FIXED_STEPS.COMPLETED) summary.completed++;
                    else if (fixedStep === FIXED_STEPS.HOLD) summary.onHold++;
                    else if (person.step) summary.started++;
                }
            }
        }
        return summary.people > 0 ? summary : null;
    } catch (err) {
        throw err;
    }
};

// GET /api/job-orders - newest first; search by number, customer name /
// phone / email or place;
// each with how its work is going (workSummaryOf).
const listJobOrders = async ({ vendorId, search, page, limit }) => {
    try {
        const filter = { vendorId, status: 'A' };
        if (search) {
            const pattern = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter.$or = [{ jobOrderNumber: pattern }, { 'customer.name': pattern }, { 'customer.phone': pattern }, { 'customer.email': pattern }, { 'customer.cityName': pattern }, { 'customer.stateName': pattern }, { 'customer.countryName': pattern }];
        }
        const [total, jobOrders] = await Promise.all([
            JobOrder.countDocuments(filter),
            JobOrder.find(filter).select(LIST_FIELDS).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean()
        ]);
        return common.returnResult(true, 200, 'Job orders fetched successfully.', {
            jobOrders: jobOrders.map(({ masters, ...jobOrder }) => ({ ...jobOrder, work: workSummaryOf(masters) })),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        });
    } catch (err) {
        throw err;
    }
};

// GET /api/job-orders/:id
const getJobOrder = async ({ vendorId, id }) => {
    try {
        const jobOrder = await JobOrder.findOne({ _id: id, vendorId, status: 'A' })
            .select('-vendorId -createdBy -updatedBy -deletedBy -deletedDate -activeMarkedBy -activeMarkedDate -inActiveMarkedBy -inactiveMarkedDate -__v').lean();
        if (!jobOrder) return common.returnResult(false, 404, 'Job order not found.');
        return common.returnResult(true, 200, 'Job order fetched successfully.', { jobOrder });
    } catch (err) {
        throw err;
    }
};

// DELETE /api/job-orders/:id - cancels it (kept, hidden from the list; its
// typed number can be used again).
const cancelJobOrder = async ({ vendorId, userId, id }) => {
    try {
        const result = await common.softDelete(JobOrder, id, userId, vendorId);
        if (!result.isSuccess) return result.statusCode === 404 ? common.returnResult(false, 404, 'Job order not found.') : result;
        const { _id: jobOrderId, jobOrderNumber, masters } = result.meta.document;
        notificationService.inBackground('Announcing a cancelled job order failed', () => notificationService.announceJobOrderSaved({
            vendorId, jobOrderId, jobOrderNumber, before: masters, isCancelled: true
        }));
        return common.returnResult(true, 200, `Job order ${jobOrderNumber} cancelled.`);
    } catch (err) {
        throw err;
    }
};

module.exports = {
    getFormData,
    createJobOrder,
    updateJobOrder,
    listJobOrders,
    getJobOrder,
    cancelJobOrder
};
