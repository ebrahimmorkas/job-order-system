const customerService = require('../services/customerService');
const { sendResult } = require('../utils/common');
const { logInfo, logException } = require('../utils/logger');

// Every route here already passed: login, the Customers feature switch, the
// permission and the Joi validation (routes/customerRoutes.js).

const respond = (res, result, meta) => {
    if (result.isSuccess) logInfo(1, 0, result.message, meta);
    else logInfo(0, 1, result.message, meta);
    return sendResult(res, result);
};

// GET /api/customers/for-job-order
const searchForJobOrder = async (req, res) => {
    try {
        const result = await customerService.searchForJobOrder({ vendorId: req.vendorId, search: req.query.search });
        return sendResult(res, result);
    } catch (err) {
        logException('Error while searching customers', err);
    }
};

// GET /api/customers/form-data
const getFormData = async (req, res) => {
    try {
        const result = await customerService.getFormData({ companyMasterData: req.companyMasterData });
        return sendResult(res, result);
    } catch (err) {
        logException('Error while fetching the customer form', err);
    }
};

// GET /api/customers
const listCustomers = async (req, res) => {
    try {
        const result = await customerService.listCustomers({ vendorId: req.vendorId, ...req.query });
        return sendResult(res, result);
    } catch (err) {
        logException('Error while fetching customers', err);
    }
};

// GET /api/customers/:id
const getCustomer = async (req, res) => {
    try {
        const result = await customerService.getCustomer({ vendorId: req.vendorId, id: req.params.id });
        return sendResult(res, result);
    } catch (err) {
        logException('Error while fetching the customer', err);
    }
};

// PUT /api/customers/:id
const updateCustomer = async (req, res) => {
    try {
        const result = await customerService.updateCustomer({
            vendorId: req.vendorId, userId: req.user._id, id: req.params.id, data: req.body, companyMasterData: req.companyMasterData
        });
        return respond(res, result, { vendorId: req.vendorId, customerId: req.params.id });
    } catch (err) {
        logException('Error while saving the customer', err);
    }
};

// DELETE /api/customers/:id
const deleteCustomer = async (req, res) => {
    try {
        const result = await customerService.deleteCustomer({ vendorId: req.vendorId, userId: req.user._id, id: req.params.id });
        return respond(res, result, { vendorId: req.vendorId, customerId: req.params.id });
    } catch (err) {
        logException('Error while deleting the customer', err);
    }
};

// POST /api/customers/bulk
const bulkDeleteCustomers = async (req, res) => {
    try {
        const result = await customerService.bulkDeleteCustomers({ vendorId: req.vendorId, userId: req.user._id, ids: req.body.ids });
        return respond(res, result, { vendorId: req.vendorId, count: req.body.ids.length });
    } catch (err) {
        logException('Error while deleting customers', err);
    }
};

module.exports = {
    searchForJobOrder,
    getFormData,
    listCustomers,
    getCustomer,
    updateCustomer,
    deleteCustomer,
    bulkDeleteCustomers
};
