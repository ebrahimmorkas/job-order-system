const Layout = require('../models/Layout');
const Master = require('../models/Master');
const Control = require('../models/Control');
const CountryMaster = require('../models/CountryMaster');
const StateMaster = require('../models/StateMaster');
const CityMaster = require('../models/CityMaster');
const common = require('../utils/common');
const { LIVE_STATUSES } = require('../constants/masterConstants');
const { SHORT_NAME_PLACES } = require('../constants/jobOrderConstants');
const { jobOrderSettingsOf } = require('./companySettingsService');
const { FEATURE_FLAGS } = require('../constants/featureConstants');
const {
    PAPER_SIZES, CUSTOM_PAPER, ELEMENT_TYPES, IMAGE_FITS, FIELD_SOURCES, SYSTEM_FIELDS, SYSTEM_FIELD_KEYS, BODY_MIN_MM
} = require('../constants/layoutConstants');

// The vendor's print layouts (Layout Master). Every function is scoped by
// vendorId. A layout is a page (paper size) with elements placed on it in
// millimetres: fields (masters, controls, job order / company details), text,
// lines, rectangles, circles, tables, the logo and the job order's own images
// ("Image 1", "Image 2"... - one image each). Printing a job order fills
// the fields in (the frontend does it from the job order itself).
//
// Text formatting is kept only while CompanyMaster.isControlFeatureInLayoutOn
// is on. Limit: CompanyMaster.numberOfLayoutsAllowed (active + inactive;
// null = no limit). One active layout is the default for printing.

const LIVE = { $in: LIVE_STATUSES };
const LAYOUT_FIELDS = '_id name paper labelDefault headerHeightMm footerHeightMm elements isDefault status createdAt updatedAt';
// An item may touch the page edge (rounding of the designer's millimetres).
const EDGE_TOLERANCE_MM = 0.01;

const idOf = (value) => String(value);
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const settingsOf = (companyMasterData) => ({ canFormatText: companyMasterData?.isControlFeatureInLayoutOn === true });
const limitsOf = (companyMasterData) => ({ layoutsAllowed: companyMasterData?.numberOfLayoutsAllowed ?? null });

// The page as printed: a named size turned for landscape, or the typed size.
const paperOf = (paper) => {
    try {
        if (paper.size === CUSTOM_PAPER) {
            return { size: CUSTOM_PAPER, orientation: paper.widthMm > paper.heightMm ? 'landscape' : 'portrait', widthMm: paper.widthMm, heightMm: paper.heightMm };
        }
        const { widthMm, heightMm } = PAPER_SIZES[paper.size];
        const isLandscape = paper.orientation === 'landscape';
        return { size: paper.size, orientation: paper.orientation, widthMm: isLandscape ? heightMm : widthMm, heightMm: isLandscape ? widthMm : heightMm };
    } catch (err) {
        throw err;
    }
};

// The masters and controls a layout can show (not deleted), in their order.
const sourcesOf = async (vendorId) => {
    try {
        const [masters, controls] = await Promise.all([
            Master.find({ vendorId, status: LIVE }).select('_id name shortName status').sort({ precedence: 1 }).lean(),
            Control.find({ vendorId, status: LIVE }).select('_id label type isPrice status').sort({ precedence: 1 }).lean()
        ]);
        return { masters, controls };
    } catch (err) {
        throw err;
    }
};

// What is saved, or field errors (elements.<id>). Every element must be on
// the page and every master / control it shows must still exist.
const checkLayout = ({ data, sources, settings }) => {
    try {
        const errors = [];
        const paper = paperOf(data.paper);
        const known = new Set([...sources.masters, ...sources.controls].map((doc) => idOf(doc._id)));
        const isKnown = (field) => !field || field.source === FIELD_SOURCES.SYSTEM || known.has(field.refId);
        const ids = new Set();
        const elements = [];
        if (data.headerHeightMm + data.footerHeightMm > paper.heightMm - BODY_MIN_MM) {
            errors.push({ field: 'headerHeightMm', message: `The header and footer leave too little room: keep at least ${BODY_MIN_MM} mm between them.` });
        }

        for (const source of data.elements) {
            const field = `elements.${source.id}`;
            if (ids.has(source.id)) {
                errors.push({ field: 'elements', message: 'Two items have the same id. Please reload the page.' });
                continue;
            }
            ids.add(source.id);
            if (source.x + source.width > paper.widthMm + EDGE_TOLERANCE_MM || source.y + source.height > paper.heightMm + EDGE_TOLERANCE_MM) {
                errors.push({ field, message: 'This item goes outside the page. Move it or make it smaller.' });
                continue;
            }
            const cellFields = source.type === ELEMENT_TYPES.TABLE ? source.table.cells.flat().map((cell) => cell.field) : [];
            if (![source.field, ...cellFields].every(isKnown)) {
                errors.push({ field, message: 'A master or control on this item no longer exists. Please remove it.' });
                continue;
            }
            const element = { ...source };
            if (element.type === ELEMENT_TYPES.LINE && !element.direction) element.direction = 'horizontal';
            if (element.type === ELEMENT_TYPES.IMAGE && !element.fit) element.fit = IMAGE_FITS[0];
            if (!settings.canFormatText) delete element.style;
            elements.push(element);
        }
        return {
            errors,
            doc: { name: data.name, paper, labelDefault: data.labelDefault, headerHeightMm: data.headerHeightMm, footerHeightMm: data.footerHeightMm, elements }
        };
    } catch (err) {
        throw err;
    }
};

const invalid = (errors) => common.returnResult(false, 400, errors[0].message, { errors });

const duplicateResult = (err, name) => {
    try {
        if (err?.code !== 11000) return null;
        const message = `A layout named "${name}" already exists.`;
        return common.returnResult(false, 409, message, { errors: [{ field: 'name', message }] });
    } catch (error) {
        throw error;
    }
};

// "Line 1, Line 2, City, State 400001, Country" of the business in each of
// its countries, and the tax numbers it is registered with there.
const companyByCountryOf = async (companySettingsData) => {
    try {
        const details = companySettingsData?.taxDetails || [];
        if (details.length === 0) return {};
        const ids = (key) => details.map((detail) => detail.address?.[key]).filter(Boolean);
        const [countries, states, cities] = await Promise.all([
            CountryMaster.find({ _id: { $in: details.map((detail) => detail.countryId) } }).select('_id name taxFields').lean(),
            StateMaster.find({ _id: { $in: ids('stateId') } }).select('_id name').lean(),
            CityMaster.find({ _id: { $in: ids('cityId') } }).select('_id name').lean()
        ]);
        const byId = new Map([...countries, ...states, ...cities].map((doc) => [idOf(doc._id), doc]));
        const result = {};
        for (const detail of details) {
            const country = byId.get(idOf(detail.countryId));
            const address = detail.address || {};
            const cityState = [byId.get(idOf(address.cityId))?.name, [byId.get(idOf(address.stateId))?.name, address.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
            const values = detail.taxFieldValues instanceof Map ? Object.fromEntries(detail.taxFieldValues) : (detail.taxFieldValues || {});
            result[idOf(detail.countryId)] = {
                address: [address.line1, address.line2, cityState, country?.name].filter(Boolean).join(', '),
                taxIds: detail.isTaxRegistered
                    ? (country?.taxFields || []).filter((taxField) => values[taxField.key]).map((taxField) => ({ label: taxField.label, value: values[taxField.key] }))
                    : []
            };
        }
        return result;
    } catch (err) {
        throw err;
    }
};

// ---- the designer ---------------------------------------------------------------

// GET /api/layouts/form-data - what can be placed on a layout. Job order
// images are offered only while image upload is on (saved ones still print).
const getFormData = async ({ vendorId, websiteMasterData, companyMasterData, companySettingsData }) => {
    try {
        const sources = await sourcesOf(vendorId);
        return common.returnResult(true, 200, 'Layout form fetched successfully.', {
            ...sources,
            systemFields: SYSTEM_FIELD_KEYS.map((key) => ({ key, label: SYSTEM_FIELDS[key] })),
            paperSizes: Object.entries(PAPER_SIZES).map(([key, size]) => ({ key, ...size })),
            settings: {
                ...settingsOf(companyMasterData),
                canPlaceJobOrderImages: websiteMasterData?.[FEATURE_FLAGS.IMAGE_UPLOAD] === true && companyMasterData?.[FEATURE_FLAGS.IMAGE_UPLOAD] === true
            },
            limits: limitsOf(companyMasterData),
            company: { name: companySettingsData?.companyName || '', logoUrl: companySettingsData?.logo?.url || null }
        });
    } catch (err) {
        throw err;
    }
};

// ---- layouts --------------------------------------------------------------------

// GET /api/layouts - newest first; search by name; filter by status.
const listLayouts = async ({ vendorId, search, status, page, limit, companyMasterData }) => {
    try {
        const filter = { vendorId, status: status || LIVE };
        if (search) filter.name = new RegExp(escapeRegex(search), 'i');
        const isUnfiltered = !search && !status;

        const [total, layouts, layoutsUsed] = await Promise.all([
            Layout.countDocuments(filter),
            Layout.aggregate([
                { $match: filter },
                { $sort: { createdAt: -1, _id: -1 } },
                { $skip: (page - 1) * limit },
                { $limit: limit },
                { $project: { name: 1, paper: 1, isDefault: 1, status: 1, createdAt: 1, elementsCount: { $size: '$elements' } } }
            ]),
            isUnfiltered ? null : Layout.countDocuments({ vendorId, status: LIVE })
        ]);
        return common.returnResult(true, 200, 'Layouts fetched successfully.', {
            layouts,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
            limits: { ...limitsOf(companyMasterData), layoutsUsed: isUnfiltered ? total : layoutsUsed }
        });
    } catch (err) {
        throw err;
    }
};

// GET /api/layouts/:id
const getLayout = async ({ vendorId, id }) => {
    try {
        const layout = await Layout.findOne({ _id: id, vendorId, status: LIVE }).select(LAYOUT_FIELDS).lean();
        if (!layout) return common.returnResult(false, 404, 'Layout not found.');
        return common.returnResult(true, 200, 'Layout fetched successfully.', { layout });
    } catch (err) {
        throw err;
    }
};

// POST /api/layouts (also saves a copy). The first one becomes the default.
const createLayout = async ({ vendorId, data, companyMasterData }) => {
    try {
        const { layoutsAllowed } = limitsOf(companyMasterData);
        const [layoutsUsed, hasDefault, sources] = await Promise.all([
            Layout.countDocuments({ vendorId, status: LIVE }),
            Layout.exists({ vendorId, status: 'A', isDefault: true }),
            sourcesOf(vendorId)
        ]);
        if (layoutsAllowed !== null && layoutsUsed >= layoutsAllowed) {
            return common.returnResult(false, 403, `You can have at most ${layoutsAllowed} layouts. Delete one you no longer need to add another.`);
        }

        const { errors, doc } = checkLayout({ data, sources, settings: settingsOf(companyMasterData) });
        if (errors.length > 0) return invalid(errors);

        let layout;
        try {
            layout = await Layout.create({ vendorId, ...doc, isDefault: !hasDefault });
        } catch (err) {
            const duplicate = duplicateResult(err, data.name);
            if (duplicate) return duplicate;
            throw err;
        }
        return common.returnResult(true, 201, `Layout "${layout.name}" created.`, { layout: { _id: layout._id, name: layout.name } });
    } catch (err) {
        throw err;
    }
};

// PUT /api/layouts/:id - the page and every element.
const updateLayout = async ({ vendorId, userId, id, data, companyMasterData }) => {
    try {
        const { errors, doc } = checkLayout({ data, sources: await sourcesOf(vendorId), settings: settingsOf(companyMasterData) });
        if (errors.length > 0) return invalid(errors);

        let layout;
        try {
            layout = await Layout.findOneAndUpdate(
                { _id: id, vendorId, status: LIVE },
                { $set: doc },
                { returnDocument: 'after', runValidators: true, auditUserId: userId, projection: { _id: 1, name: 1 } }
            ).lean();
        } catch (err) {
            const duplicate = duplicateResult(err, data.name);
            if (duplicate) return duplicate;
            throw err;
        }
        if (!layout) return common.returnResult(false, 404, 'Layout not found.');
        return common.returnResult(true, 200, `Layout "${layout.name}" saved.`, { layout });
    } catch (err) {
        throw err;
    }
};

// PATCH /api/layouts/:id/default - picked in advance when printing. Only an
// active layout; the previous default stops being one.
const setDefaultLayout = async ({ vendorId, userId, id }) => {
    try {
        const layout = await Layout.findOne({ _id: id, vendorId, status: 'A' }).select('_id name').lean();
        if (!layout) return common.returnResult(false, 404, 'Layout not found, or inactive.');
        await Layout.updateMany({ vendorId, isDefault: true, _id: { $ne: layout._id } }, { $set: { isDefault: false } }, { auditUserId: userId });
        await Layout.updateOne({ _id: layout._id, vendorId }, { $set: { isDefault: true } }, { auditUserId: userId });
        return common.returnResult(true, 200, `"${layout.name}" is now the default layout.`);
    } catch (err) {
        throw err;
    }
};

// PATCH /api/layouts/:id/status - an inactive layout is no longer the default.
const setLayoutStatus = async ({ vendorId, userId, id, isActive }) => {
    try {
        const result = await common.toggleActiveStatus(Layout, id, userId, isActive, vendorId);
        if (!result.isSuccess) return result.statusCode === 404 ? common.returnResult(false, 404, 'Layout not found.') : result;
        if (!isActive && result.meta.document.isDefault) {
            await Layout.updateOne({ _id: result.meta.document._id }, { $set: { isDefault: false } }, { auditUserId: userId });
        }
        return common.returnResult(true, 200, isActive ? 'Layout marked as active.' : 'Layout marked as inactive.', {
            layout: { _id: result.meta.document._id, status: result.meta.document.status }
        });
    } catch (err) {
        throw err;
    }
};

// DELETE /api/layouts/:id - soft delete; its name can be used again.
const deleteLayout = async ({ vendorId, userId, id }) => {
    try {
        const result = await common.softDelete(Layout, id, userId, vendorId);
        if (!result.isSuccess) return result.statusCode === 404 ? common.returnResult(false, 404, 'Layout not found.') : result;
        if (result.meta.document.isDefault) {
            await Layout.updateOne({ _id: result.meta.document._id }, { $set: { isDefault: false } }, { auditUserId: userId });
        }
        return common.returnResult(true, 200, 'Layout deleted.');
    } catch (err) {
        throw err;
    }
};

const BULK_ACTIONS = {
    activate: (args) => setLayoutStatus({ ...args, isActive: true }),
    deactivate: (args) => setLayoutStatus({ ...args, isActive: false }),
    delete: deleteLayout
};

// POST /api/layouts/bulk - each layout on its own; meta.results says how each went.
const bulkUpdateLayouts = async ({ vendorId, userId, action, ids }) => {
    try {
        const run = BULK_ACTIONS[action];
        return await common.runBulkOperation(ids, (id) => run({ vendorId, userId, id }));
    } catch (err) {
        throw err;
    }
};

// ---- printing (any logged-in user of the vendor) -----------------------------------

// GET /api/layouts/for-print - the active layouts, default first.
const listLayoutsForPrint = async ({ vendorId }) => {
    try {
        const layouts = await Layout.find({ vendorId, status: 'A' }).select('_id name isDefault paper').sort({ isDefault: -1, name: 1 }).lean();
        return common.returnResult(true, 200, 'Layouts fetched successfully.', { layouts });
    } catch (err) {
        throw err;
    }
};

// GET /api/layouts/for-print/:id - one active layout and what fills it
// besides the job order: the names of its masters / controls (a label still
// prints when the job order left one empty), the company's name, logo,
// address and tax numbers (per country), and the print settings.
const getLayoutForPrint = async ({ vendorId, id, companyMasterData, companySettingsData }) => {
    try {
        const layout = await Layout.findOne({ _id: id, vendorId, status: 'A' }).select(LAYOUT_FIELDS).lean();
        if (!layout) return common.returnResult(false, 404, 'Layout not found, or inactive.');
        const useShortNamesOn = companySettingsData?.useShortNamesOn;
        const [sources, byCountry] = await Promise.all([sourcesOf(vendorId), companyByCountryOf(companySettingsData)]);
        return common.returnResult(true, 200, 'Layout fetched successfully.', {
            layout,
            masters: sources.masters.map(({ _id, name, shortName }) => ({ _id, name, shortName })),
            controls: sources.controls.map(({ _id, label }) => ({ _id, label })),
            company: {
                name: companySettingsData?.companyName || '',
                logoUrl: companySettingsData?.logo?.url || null,
                byCountry
            },
            settings: {
                ...settingsOf(companyMasterData),
                useShortNames: useShortNamesOn === SHORT_NAME_PLACES.PRINT || useShortNamesOn === SHORT_NAME_PLACES.BOTH,
                printWork: jobOrderSettingsOf(companySettingsData).printWork
            }
        });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    getFormData,
    listLayouts,
    getLayout,
    createLayout,
    updateLayout,
    setDefaultLayout,
    setLayoutStatus,
    deleteLayout,
    bulkUpdateLayouts,
    listLayoutsForPrint,
    getLayoutForPrint
};
