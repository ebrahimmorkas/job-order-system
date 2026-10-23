const userService = require('../services/userService');
const { sendResult } = require('../utils/common');
const { logInfo, logException } = require('../utils/logger');

// Every route here already passed: login, owner role, the RBAC feature switch
// and the Joi validation (routes/userRoutes.js).

const respond = (res, result, meta) => {
    if (result.isSuccess) logInfo(1, 0, result.message, meta);
    else logInfo(0, 1, result.message, meta);
    return sendResult(res, result);
};

// The vendor's cached documents (which modules are on, the users limit and settings).
const vendorData = (req) => ({
    vendorId: req.vendorId,
    websiteMasterData: req.websiteMasterData,
    companyMasterData: req.companyMasterData
});

// GET /api/users/form-data
const getFormData = async (req, res) => {
    try {
        const result = await userService.getFormData(vendorData(req));
        return sendResult(res, result);
    } catch (err) {
        logException('Error while fetching the user form', err);
    }
};

// GET /api/users
const listUsers = async (req, res) => {
    try {
        const result = await userService.listUsers({ vendorId: req.vendorId, ...req.query, companyMasterData: req.companyMasterData });
        return sendResult(res, result);
    } catch (err) {
        logException('Error while fetching users', err);
    }
};

// GET /api/users/:id
const getUser = async (req, res) => {
    try {
        const result = await userService.getUser({ vendorId: req.vendorId, id: req.params.id });
        return sendResult(res, result);
    } catch (err) {
        logException('Error while fetching the user', err);
    }
};

// POST /api/users
const createUser = async (req, res) => {
    try {
        const result = await userService.createUser({ ...vendorData(req), userId: req.user._id, data: req.body });
        return respond(res, result, { vendorId: req.vendorId });
    } catch (err) {
        logException('Error while creating the user', err);
    }
};

// PUT /api/users/:id
const updateUser = async (req, res) => {
    try {
        const result = await userService.updateUser({ ...vendorData(req), userId: req.user._id, id: req.params.id, data: req.body });
        return respond(res, result, { vendorId: req.vendorId, targetUserId: req.params.id });
    } catch (err) {
        logException('Error while updating the user', err);
    }
};

// PATCH /api/users/:id/status
const setUserStatus = async (req, res) => {
    try {
        const result = await userService.setUserStatus({ vendorId: req.vendorId, userId: req.user._id, id: req.params.id, isActive: req.body.isActive });
        return respond(res, result, { vendorId: req.vendorId, targetUserId: req.params.id });
    } catch (err) {
        logException('Error while changing the user status', err);
    }
};

// DELETE /api/users/:id
const deleteUser = async (req, res) => {
    try {
        const result = await userService.deleteUser({ vendorId: req.vendorId, userId: req.user._id, id: req.params.id });
        return respond(res, result, { vendorId: req.vendorId, targetUserId: req.params.id });
    } catch (err) {
        logException('Error while deleting the user', err);
    }
};

// POST /api/users/bulk
const bulkUpdateUsers = async (req, res) => {
    try {
        const result = await userService.bulkUpdateUsers({ vendorId: req.vendorId, userId: req.user._id, ...req.body });
        return respond(res, result, { vendorId: req.vendorId, action: req.body.action });
    } catch (err) {
        logException('Error while updating several users', err);
    }
};

module.exports = {
    getFormData,
    listUsers,
    getUser,
    createUser,
    updateUser,
    setUserStatus,
    deleteUser,
    bulkUpdateUsers
};
