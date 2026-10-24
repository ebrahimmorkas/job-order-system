const layoutService = require('../services/layoutService');
const { sendResult } = require('../utils/common');
const { logInfo, logException } = require('../utils/logger');

// Every route here already passed: login, the Layout Master feature switch,
// the owner role (except the print routes) and the Joi validation
// (routes/layoutRoutes.js).

const respond = (res, result, meta) => {
    if (result.isSuccess) logInfo(1, 0, result.message, meta);
    else logInfo(0, 1, result.message, meta);
    return sendResult(res, result);
};

// The vendor's cached documents (text formatting switch, limit, company).
const vendorData = (req) => ({
    vendorId: req.vendorId,
    websiteMasterData: req.websiteMasterData,
    companyMasterData: req.companyMasterData,
    companySettingsData: req.companySettingsData
});

// GET /api/layouts/form-data
const getFormData = async (req, res) => {
    try {
        const result = await layoutService.getFormData(vendorData(req));
        return sendResult(res, result);
    } catch (err) {
        logException('Error while fetching the layout form', err);
    }
};

// GET /api/layouts
const listLayouts = async (req, res) => {
    try {
        const result = await layoutService.listLayouts({ vendorId: req.vendorId, ...req.query, companyMasterData: req.companyMasterData });
        return sendResult(res, result);
    } catch (err) {
        logException('Error while fetching layouts', err);
    }
};

// GET /api/layouts/:id
const getLayout = async (req, res) => {
    try {
        const result = await layoutService.getLayout({ vendorId: req.vendorId, id: req.params.id });
        return sendResult(res, result);
    } catch (err) {
        logException('Error while fetching the layout', err);
    }
};

// POST /api/layouts
const createLayout = async (req, res) => {
    try {
        const result = await layoutService.createLayout({ ...vendorData(req), data: req.body });
        return respond(res, result, { vendorId: req.vendorId });
    } catch (err) {
        logException('Error while creating the layout', err);
    }
};

// PUT /api/layouts/:id
const updateLayout = async (req, res) => {
    try {
        const result = await layoutService.updateLayout({ ...vendorData(req), userId: req.user._id, id: req.params.id, data: req.body });
        return respond(res, result, { vendorId: req.vendorId, layoutId: req.params.id });
    } catch (err) {
        logException('Error while updating the layout', err);
    }
};

// PATCH /api/layouts/:id/default
const setDefaultLayout = async (req, res) => {
    try {
        const result = await layoutService.setDefaultLayout({ vendorId: req.vendorId, userId: req.user._id, id: req.params.id });
        return respond(res, result, { vendorId: req.vendorId, layoutId: req.params.id });
    } catch (err) {
        logException('Error while setting the default layout', err);
    }
};

// PATCH /api/layouts/:id/status
const setLayoutStatus = async (req, res) => {
    try {
        const result = await layoutService.setLayoutStatus({ vendorId: req.vendorId, userId: req.user._id, id: req.params.id, isActive: req.body.isActive });
        return respond(res, result, { vendorId: req.vendorId, layoutId: req.params.id });
    } catch (err) {
        logException('Error while changing the layout status', err);
    }
};

// DELETE /api/layouts/:id
const deleteLayout = async (req, res) => {
    try {
        const result = await layoutService.deleteLayout({ vendorId: req.vendorId, userId: req.user._id, id: req.params.id });
        return respond(res, result, { vendorId: req.vendorId, layoutId: req.params.id });
    } catch (err) {
        logException('Error while deleting the layout', err);
    }
};

// POST /api/layouts/bulk
const bulkUpdateLayouts = async (req, res) => {
    try {
        const result = await layoutService.bulkUpdateLayouts({ vendorId: req.vendorId, userId: req.user._id, ...req.body });
        return respond(res, result, { vendorId: req.vendorId, action: req.body.action });
    } catch (err) {
        logException('Error while updating several layouts', err);
    }
};

// GET /api/layouts/for-print
const listLayoutsForPrint = async (req, res) => {
    try {
        const result = await layoutService.listLayoutsForPrint({ vendorId: req.vendorId });
        return sendResult(res, result);
    } catch (err) {
        logException('Error while fetching layouts for printing', err);
    }
};

// GET /api/layouts/for-print/:id
const getLayoutForPrint = async (req, res) => {
    try {
        const result = await layoutService.getLayoutForPrint({ ...vendorData(req), id: req.params.id });
        return sendResult(res, result);
    } catch (err) {
        logException('Error while fetching the layout for printing', err);
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
