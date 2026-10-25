const jobOrderService = require('../services/jobOrderService');
const { sendResult } = require('../utils/common');
const { logInfo, logException } = require('../utils/logger');

// Every route here already passed: login and the Joi validation
// (routes/jobOrderRoutes.js). Any logged-in user of the vendor may use them.

const respond = (res, result, meta) => {
    if (result.isSuccess) logInfo(1, 0, result.message, meta);
    else logInfo(0, 1, result.message, meta);
    return sendResult(res, result);
};

// The vendor's cached documents the form and the checks come from.
const vendorData = (req) => ({
    vendorId: req.vendorId,
    websiteMasterData: req.websiteMasterData,
    companyMasterData: req.companyMasterData,
    companySettingsData: req.companySettingsData
});

// GET /api/job-orders/form-data
const getFormData = async (req, res) => {
    try {
        const result = await jobOrderService.getFormData(vendorData(req));
        return sendResult(res, result);
    } catch (err) {
        logException('Error while fetching the job order form', err);
    }
};

// GET /api/job-orders
const listJobOrders = async (req, res) => {
    try {
        const result = await jobOrderService.listJobOrders({ ...vendorData(req), ...req.query });
        return sendResult(res, result);
    } catch (err) {
        logException('Error while fetching job orders', err);
    }
};

// GET /api/job-orders/:id
const getJobOrder = async (req, res) => {
    try {
        const result = await jobOrderService.getJobOrder({ ...vendorData(req), id: req.params.id });
        return sendResult(res, result);
    } catch (err) {
        logException('Error while fetching the job order', err);
    }
};

// POST /api/job-orders
const createJobOrder = async (req, res) => {
    try {
        const result = await jobOrderService.createJobOrder({ ...vendorData(req), userId: req.user._id, data: req.body, files: req.files || [] });
        return respond(res, result, { vendorId: req.vendorId });
    } catch (err) {
        logException('Error while creating the job order', err);
    }
};

// PUT /api/job-orders/:id
const updateJobOrder = async (req, res) => {
    try {
        const result = await jobOrderService.updateJobOrder({ ...vendorData(req), userId: req.user._id, id: req.params.id, data: req.body, files: req.files || [] });
        return respond(res, result, { vendorId: req.vendorId, jobOrderId: req.params.id });
    } catch (err) {
        logException('Error while updating the job order', err);
    }
};

// DELETE /api/job-orders/:id
const cancelJobOrder = async (req, res) => {
    try {
        const result = await jobOrderService.cancelJobOrder({ vendorId: req.vendorId, userId: req.user._id, id: req.params.id });
        return respond(res, result, { vendorId: req.vendorId, jobOrderId: req.params.id });
    } catch (err) {
        logException('Error while cancelling the job order', err);
    }
};

// PATCH /api/job-orders/:id/step
const setJobOrderStep = async (req, res) => {
    try {
        const result = await jobOrderService.setJobOrderStep({ ...vendorData(req), userId: req.user._id, id: req.params.id, data: req.body });
        return respond(res, result, { vendorId: req.vendorId, jobOrderId: req.params.id });
    } catch (err) {
        logException('Error while changing the job order step', err);
    }
};

module.exports = {
    getFormData,
    setJobOrderStep,
    listJobOrders,
    getJobOrder,
    createJobOrder,
    updateJobOrder,
    cancelJobOrder
};
