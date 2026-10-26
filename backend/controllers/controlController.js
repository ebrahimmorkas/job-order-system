const controlService = require('../services/controlService');
const { sendResult } = require('../utils/common');
const { logInfo, logException } = require('../utils/logger');

// Every route here already passed: login, owner role, the controls feature
// switch, at least one assigned control type and the Joi validation
// (routes/controlRoutes.js) - except for-job-order, which any logged-in user
// of the vendor may call and which also works through
// CompanyMaster.fetchControlsEvenWhenBitIsOff.

const respond = (res, result, meta) => {
    if (result.isSuccess) logInfo(1, 0, result.message, meta);
    else logInfo(0, 1, result.message, meta);
    return sendResult(res, result);
};

// The vendor's cached documents the limits come from (tax: are its details filled).
const vendorData = (req) => ({
    companyMasterData: req.companyMasterData,
    websiteMasterData: req.websiteMasterData,
    companySettingsData: req.companySettingsData
});

// GET /api/controls/for-job-order
const getControlsForJobOrder = async (req, res) => {
    try {
        const result = await controlService.getControlsForJobOrder({ vendorId: req.vendorId, companyMasterData: req.companyMasterData, websiteMasterData: req.websiteMasterData });
        return sendResult(res, result);
    } catch (err) {
        logException('Error while fetching controls for the job order', err);
    }
};

// GET /api/controls/form-data
const getFormData = async (req, res) => {
    try {
        const result = await controlService.getFormData({ vendorId: req.vendorId, ...vendorData(req) });
        return sendResult(res, result);
    } catch (err) {
        logException('Error while fetching the control form', err);
    }
};

// GET /api/controls
const listControls = async (req, res) => {
    try {
        const result = await controlService.listControls({ vendorId: req.vendorId, ...req.query, ...vendorData(req) });
        return sendResult(res, result);
    } catch (err) {
        logException('Error while fetching controls', err);
    }
};

// GET /api/controls/:id
const getControl = async (req, res) => {
    try {
        const result = await controlService.getControl({ vendorId: req.vendorId, id: req.params.id, ...vendorData(req) });
        return sendResult(res, result);
    } catch (err) {
        logException('Error while fetching the control', err);
    }
};

// POST /api/controls
const createControl = async (req, res) => {
    try {
        const result = await controlService.createControl({
            vendorId: req.vendorId, userId: req.user._id, data: req.body, ...vendorData(req)
        });
        return respond(res, result, { vendorId: req.vendorId });
    } catch (err) {
        logException('Error while creating the control', err);
    }
};

// PUT /api/controls/:id
const updateControl = async (req, res) => {
    try {
        const result = await controlService.updateControl({
            vendorId: req.vendorId, userId: req.user._id, id: req.params.id, data: req.body, ...vendorData(req)
        });
        return respond(res, result, { vendorId: req.vendorId, controlId: req.params.id });
    } catch (err) {
        logException('Error while updating the control', err);
    }
};

// PATCH /api/controls/:id/status
const setControlStatus = async (req, res) => {
    try {
        const result = await controlService.setControlStatus({
            vendorId: req.vendorId, userId: req.user._id, id: req.params.id, isActive: req.body.isActive, companyMasterData: req.companyMasterData
        });
        return respond(res, result, { vendorId: req.vendorId, controlId: req.params.id });
    } catch (err) {
        logException('Error while changing the control status', err);
    }
};

// PATCH /api/controls/:id/move
const moveControl = async (req, res) => {
    try {
        const result = await controlService.moveControl({
            vendorId: req.vendorId, userId: req.user._id, id: req.params.id, direction: req.body.direction, companyMasterData: req.companyMasterData
        });
        return respond(res, result, { vendorId: req.vendorId, controlId: req.params.id });
    } catch (err) {
        logException('Error while moving the control', err);
    }
};

// DELETE /api/controls/:id
const deleteControl = async (req, res) => {
    try {
        const result = await controlService.deleteControl({
            vendorId: req.vendorId, userId: req.user._id, id: req.params.id, companyMasterData: req.companyMasterData
        });
        return respond(res, result, { vendorId: req.vendorId, controlId: req.params.id });
    } catch (err) {
        logException('Error while deleting the control', err);
    }
};

// POST /api/controls/bulk
const bulkUpdateControls = async (req, res) => {
    try {
        const result = await controlService.bulkUpdateControls({
            vendorId: req.vendorId, userId: req.user._id, action: req.body.action, ids: req.body.ids, companyMasterData: req.companyMasterData
        });
        return respond(res, result, { vendorId: req.vendorId, action: req.body.action });
    } catch (err) {
        logException('Error while updating controls in bulk', err);
    }
};

module.exports = {
    getControlsForJobOrder,
    getFormData,
    listControls,
    getControl,
    createControl,
    updateControl,
    setControlStatus,
    moveControl,
    deleteControl,
    bulkUpdateControls
};
