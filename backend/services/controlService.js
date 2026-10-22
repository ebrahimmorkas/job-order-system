const mongoose = require('mongoose');
const Control = require('../models/Control');
const common = require('../utils/common');
const { LIVE_STATUSES } = require('../constants/masterConstants');
const { CONTROL_TYPES, CONTROL_TYPE_VALUES, TEXT_CONTROL_TYPES } = require('../constants/controlConstants');

// The vendor's controls (fields on the job order form). Every function is
// scoped by vendorId, and only sees the control types assigned to the vendor
// (CompanyMaster.assignedControls): controls of a type taken away are hidden
// everywhere, as if they didn't exist, and come back if it is given again.
//
// Every limit comes from CompanyMaster, and null there means no limit.

const LIVE = { $in: LIVE_STATUSES };
const CONTROL_FIELDS = '_id type label isRequired placeholder defaultText isPrice isPriceIncludedInTax defaultChecked options defaultOptionId precedence status updatedAt';

const TYPE_NAMES = {
    [CONTROL_TYPES.TEXTFIELD]: 'text field',
    [CONTROL_TYPES.TEXTAREA]: 'text area',
    [CONTROL_TYPES.CHECKBOX]: 'checkbox',
    [CONTROL_TYPES.RADIO]: 'radio group'
};

// The control types the vendor may use: null in CompanyMaster = all of them.
const assignedTypesOf = (companyMasterData) => {
    const assigned = companyMasterData?.assignedControls;
    return Array.isArray(assigned) ? CONTROL_TYPE_VALUES.filter((type) => assigned.includes(type)) : [...CONTROL_TYPE_VALUES];
};

// Everything the vendor's CompanyMaster says about controls (null = no limit).
const limitsOf = (companyMasterData) => {
    const allowed = companyMasterData?.numberOfControlsAllowed || {};
    return {
        assignedTypes: assignedTypesOf(companyMasterData),
        controlsAllowed: Object.fromEntries(CONTROL_TYPE_VALUES.map((type) => [type, allowed[type] ?? null])),
        // Typed on the job order (and the default text), one radio choice.
        maxLength: {
            [CONTROL_TYPES.TEXTFIELD]: companyMasterData?.maxLengthOfTextfieldControl ?? null,
            [CONTROL_TYPES.TEXTAREA]: companyMasterData?.maxLengthOfTextareaControl ?? null,
            radioOption: companyMasterData?.maxLengthOfRadioButtonText ?? null
        },
        // The label of each type (a checkbox's label is its text).
        maxLabelLength: {
            [CONTROL_TYPES.TEXTFIELD]: companyMasterData?.maxTextForLabelInTextfieldControl ?? null,
            [CONTROL_TYPES.TEXTAREA]: companyMasterData?.maxTextForLabelInTextareaControl ?? null,
            [CONTROL_TYPES.CHECKBOX]: companyMasterData?.maxLengthOfCheckboxText ?? null,
            [CONTROL_TYPES.RADIO]: companyMasterData?.maxTextForLabelInRadioButtonControl ?? null
        },
        maxPlaceholderLength: {
            [CONTROL_TYPES.TEXTFIELD]: companyMasterData?.maxTextForPlaceholderInTextfieldControl ?? null,
            [CONTROL_TYPES.TEXTAREA]: companyMasterData?.maxTextForPlaceholderInTextareaControl ?? null
        },
        optionsAllowed: companyMasterData?.numberOfRadioButtonsAllowedInGroup ?? null
    };
};

const tooLong = (text, max) => max !== null && text.length > max;

// The vendor's own limits (they can't be in the Joi schema): the field
// errors as { field, message }, empty when all is fine.
const checkVendorLimits = (data, limits) => {
    try {
        const errors = [];
        const { maxLength } = limits;
        const labelMax = limits.maxLabelLength[data.type];
        if (tooLong(data.label, labelMax)) {
            const what = data.type === CONTROL_TYPES.CHECKBOX ? 'The checkbox text' : 'The label';
            errors.push({ field: 'label', message: `${what} can be at most ${labelMax} characters` });
        }
        if (TEXT_CONTROL_TYPES.includes(data.type)) {
            const placeholderMax = limits.maxPlaceholderLength[data.type];
            if (data.placeholder !== null && tooLong(data.placeholder, placeholderMax)) {
                errors.push({ field: 'placeholder', message: `The placeholder can be at most ${placeholderMax} characters` });
            }
            if (data.defaultText !== null && tooLong(data.defaultText, maxLength[data.type])) {
                errors.push({ field: 'defaultText', message: `The default text can be at most ${maxLength[data.type]} characters` });
            }
        }
        if (data.type === CONTROL_TYPES.RADIO) {
            if (limits.optionsAllowed !== null && data.options.length > limits.optionsAllowed) {
                errors.push({ field: 'options', message: `A radio group can have at most ${limits.optionsAllowed} choices` });
            }
            const longOption = data.options.find((option) => tooLong(option.name, maxLength.radioOption));
            if (longOption) errors.push({ field: 'options', message: `A choice can be at most ${maxLength.radioOption} characters` });
        }
        return errors;
    } catch (err) {
        throw err;
    }
};

const invalid = (errors) => common.returnResult(false, 400, errors[0].message, { errors });

const notAvailable = () => common.returnResult(false, 403, 'This type of control is not available for your account.');

// A unique index refused the write (the label) -> 409 for the label field.
const duplicateResult = (err, data) => {
    try {
        if (err?.code !== 11000) return null;
        const message = `A control labelled "${data.label}" already exists.`;
        return common.returnResult(false, 409, message, { errors: [{ field: 'label', message }] });
    } catch (error) {
        throw error;
    }
};

// The fields to store for the control's type. Radio choices keep their _id
// (new ones get one here, so the default can point at it).
const toStored = (data) => {
    try {
        const stored = { label: data.label, isRequired: data.isRequired };
        if (TEXT_CONTROL_TYPES.includes(data.type)) {
            stored.placeholder = data.placeholder;
            stored.defaultText = data.defaultText;
        }
        if (data.type === CONTROL_TYPES.TEXTFIELD) {
            stored.isPrice = data.isPrice;
            stored.isPriceIncludedInTax = data.isPrice && data.isPriceIncludedInTax;
        }
        if (data.type === CONTROL_TYPES.CHECKBOX) stored.defaultChecked = data.defaultChecked;
        if (data.type === CONTROL_TYPES.RADIO) {
            stored.options = data.options.map((option) => ({ _id: option._id || new mongoose.Types.ObjectId(), name: option.name }));
            const defaultIndex = data.options.findIndex((option) => option.isDefault);
            stored.defaultOptionId = defaultIndex === -1 ? null : stored.options[defaultIndex]._id;
        }
        return stored;
    } catch (err) {
        throw err;
    }
};

// ---- controls ---------------------------------------------------------------

// GET /api/controls - one page, in job order form order, with the vendor's
// limits and how many controls of each type are used.
const listControls = async ({ vendorId, search, status, type, page, limit, companyMasterData }) => {
    try {
        const limits = limitsOf(companyMasterData);
        const filter = { vendorId, type: { $in: type ? limits.assignedTypes.filter((t) => t === type) : limits.assignedTypes }, status: status || LIVE };
        if (search) filter.label = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

        const [total, controls, usedRows] = await Promise.all([
            Control.countDocuments(filter),
            Control.find(filter).select(CONTROL_FIELDS).sort({ precedence: 1 }).skip((page - 1) * limit).limit(limit).lean(),
            Control.aggregate([
                { $match: { vendorId, type: { $in: limits.assignedTypes }, status: LIVE } },
                { $group: { _id: '$type', count: { $sum: 1 } } }
            ])
        ]);
        const used = Object.fromEntries(usedRows.map((row) => [row._id, row.count]));

        return common.returnResult(true, 200, 'Controls fetched successfully.', {
            controls: controls.map(({ options, ...control }) => ({ ...control, optionsCount: options ? options.length : null })),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
            limits: { ...limits, controlsUsed: Object.fromEntries(limits.assignedTypes.map((t) => [t, used[t] || 0])) }
        });
    } catch (err) {
        throw err;
    }
};

// GET /api/controls/:id
const getControl = async ({ vendorId, id, companyMasterData }) => {
    try {
        const limits = limitsOf(companyMasterData);
        const control = await Control.findOne({ _id: id, vendorId, type: { $in: limits.assignedTypes }, status: LIVE }).select(CONTROL_FIELDS).lean();
        if (!control) return common.returnResult(false, 404, 'Control not found.');
        return common.returnResult(true, 200, 'Control fetched successfully.', { control, limits });
    } catch (err) {
        throw err;
    }
};

// POST /api/controls (also used to save a copy).
const createControl = async ({ vendorId, userId, data, companyMasterData }) => {
    try {
        const limits = limitsOf(companyMasterData);
        if (!limits.assignedTypes.includes(data.type)) return notAvailable();
        const errors = checkVendorLimits(data, limits);
        if (errors.length > 0) return invalid(errors);

        const allowed = limits.controlsAllowed[data.type];
        const [used, precedence] = await Promise.all([
            allowed === null ? 0 : Control.countDocuments({ vendorId, type: data.type, status: LIVE }),
            common.nextPrecedence(Control, { vendorId })
        ]);
        if (allowed !== null && used >= allowed) {
            return common.returnResult(false, 403, `You can have at most ${allowed} ${TYPE_NAMES[data.type]}${allowed === 1 ? '' : 's'}. Delete one you no longer need to add another.`);
        }

        let control;
        try {
            control = await Control.create({ vendorId, type: data.type, ...toStored(data), precedence });
        } catch (err) {
            const duplicate = duplicateResult(err, data);
            if (duplicate) return duplicate;
            throw err;
        }
        return common.returnResult(true, 201, 'Control created.', { control: { _id: control._id, type: control.type, label: control.label } });
    } catch (err) {
        throw err;
    }
};

// PUT /api/controls/:id - every field at once; the type can't change.
const updateControl = async ({ vendorId, userId, id, data, companyMasterData }) => {
    try {
        const limits = limitsOf(companyMasterData);
        const current = await Control.findOne({ _id: id, vendorId, type: { $in: limits.assignedTypes }, status: LIVE }).select('type options').lean();
        if (!current) return common.returnResult(false, 404, 'Control not found.');
        if (current.type !== data.type) return common.returnResult(false, 400, 'The type of a control cannot be changed.');
        const errors = checkVendorLimits(data, limits);
        if (errors.length > 0) return invalid(errors);

        if (data.type === CONTROL_TYPES.RADIO) {
            const currentIds = new Set(current.options.map((option) => String(option._id)));
            if (data.options.some((option) => option._id && !currentIds.has(option._id))) {
                return common.returnResult(false, 409, 'This control was changed meanwhile. Please reload it and make your changes again.');
            }
        }

        let control;
        try {
            control = await Control.findOneAndUpdate(
                { _id: id, vendorId, status: LIVE },
                { $set: toStored(data) },
                { returnDocument: 'after', runValidators: true, auditUserId: userId, projection: CONTROL_FIELDS }
            ).lean();
        } catch (err) {
            const duplicate = duplicateResult(err, data);
            if (duplicate) return duplicate;
            throw err;
        }
        if (!control) return common.returnResult(false, 404, 'Control not found.');
        return common.returnResult(true, 200, 'Control saved.', { control });
    } catch (err) {
        throw err;
    }
};

// PATCH /api/controls/:id/status
const setControlStatus = async ({ vendorId, userId, id, isActive, companyMasterData }) => {
    try {
        const scope = { type: { $in: assignedTypesOf(companyMasterData) } };
        const result = await common.toggleActiveStatus(Control, id, userId, isActive, vendorId, scope);
        if (!result.isSuccess) return result.statusCode === 404 ? common.returnResult(false, 404, 'Control not found.') : result;
        return common.returnResult(true, 200, isActive ? 'Control marked as active.' : 'Control marked as inactive.', {
            control: { _id: result.meta.document._id, status: result.meta.document.status }
        });
    } catch (err) {
        throw err;
    }
};

// DELETE /api/controls/:id - soft delete.
const deleteControl = async ({ vendorId, userId, id, companyMasterData }) => {
    try {
        const scope = { type: { $in: assignedTypesOf(companyMasterData) } };
        const result = await common.softDelete(Control, id, userId, vendorId, scope);
        if (!result.isSuccess) return result.statusCode === 404 ? common.returnResult(false, 404, 'Control not found.') : result;
        return common.returnResult(true, 200, 'Control deleted.');
    } catch (err) {
        throw err;
    }
};

const BULK_ACTIONS = {
    activate: (args) => setControlStatus({ ...args, isActive: true }),
    deactivate: (args) => setControlStatus({ ...args, isActive: false }),
    delete: deleteControl
};

// POST /api/controls/bulk - each control on its own; meta.results says how each went.
const bulkUpdateControls = async ({ vendorId, userId, action, ids, companyMasterData }) => {
    try {
        const run = BULK_ACTIONS[action];
        return await common.runBulkOperation(ids, (id) => run({ vendorId, userId, id, companyMasterData }));
    } catch (err) {
        throw err;
    }
};

// PATCH /api/controls/:id/move - one place up / down among the controls the
// vendor can see (across pages).
const moveControl = async ({ vendorId, userId, id, direction, companyMasterData }) => {
    try {
        const scope = { vendorId, type: { $in: assignedTypesOf(companyMasterData) } };
        return await common.swapPrecedence(Control, scope, id, direction, userId, 'control');
    } catch (err) {
        throw err;
    }
};

// ---- job order --------------------------------------------------------------

// GET /api/controls/for-job-order - the active controls of the assigned
// types, in order, with what the form needs: the longest text allowed
// (null = no limit) and the defaults. A text field also says whether it is a
// price (an amount added to the total) and whether tax is charged on it.
const getControlsForJobOrder = async ({ vendorId, companyMasterData }) => {
    try {
        const limits = limitsOf(companyMasterData);
        const controls = limits.assignedTypes.length === 0 ? [] : await Control.find({ vendorId, type: { $in: limits.assignedTypes }, status: 'A' })
            .select('_id type label isRequired placeholder defaultText isPrice isPriceIncludedInTax defaultChecked options defaultOptionId').sort({ precedence: 1 }).lean();

        return common.returnResult(true, 200, 'Controls fetched successfully.', {
            controls: controls.map((control) => {
                if (control.type === CONTROL_TYPES.TEXTFIELD) {
                    const { defaultChecked, options, defaultOptionId, ...text } = control;
                    return { ...text, isPrice: !!text.isPrice, isPriceIncludedInTax: !!text.isPriceIncludedInTax, maxLength: limits.maxLength[control.type] };
                }
                if (control.type === CONTROL_TYPES.TEXTAREA) {
                    const { isPrice, isPriceIncludedInTax, defaultChecked, options, defaultOptionId, ...text } = control;
                    return { ...text, maxLength: limits.maxLength[control.type] };
                }
                if (control.type === CONTROL_TYPES.CHECKBOX) {
                    const { placeholder, defaultText, isPrice, isPriceIncludedInTax, options, defaultOptionId, ...checkbox } = control;
                    return checkbox;
                }
                const { placeholder, defaultText, isPrice, isPriceIncludedInTax, defaultChecked, ...radio } = control;
                return radio;
            })
        });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    assignedTypesOf,
    getControlsForJobOrder,
    listControls,
    getControl,
    createControl,
    updateControl,
    setControlStatus,
    deleteControl,
    bulkUpdateControls,
    moveControl
};
