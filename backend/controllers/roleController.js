const roleService = require('../services/roleService');
const { sendResult } = require('../utils/common');
const { logInfo, logException } = require('../utils/logger');

// Every route here already passed: login, owner role, the RBAC feature switch
// and the Joi validation (routes/roleRoutes.js).

const respond = (res, result, meta) => {
    if (result.isSuccess) logInfo(1, 0, result.message, meta);
    else logInfo(0, 1, result.message, meta);
    return sendResult(res, result);
};

// The vendor's cached documents (which modules are on, the role limit).
const vendorData = (req) => ({
    vendorId: req.vendorId,
    websiteMasterData: req.websiteMasterData,
    companyMasterData: req.companyMasterData
});

// GET /api/roles/form-data
const getFormData = async (req, res) => {
    try {
        const result = await roleService.getFormData(vendorData(req));
        return sendResult(res, result);
    } catch (err) {
        logException('Error while fetching the role form', err);
    }
};

// GET /api/roles
const listRoles = async (req, res) => {
    try {
        const result = await roleService.listRoles({ vendorId: req.vendorId, ...req.query, companyMasterData: req.companyMasterData });
        return sendResult(res, result);
    } catch (err) {
        logException('Error while fetching roles', err);
    }
};

// GET /api/roles/:id
const getRole = async (req, res) => {
    try {
        const result = await roleService.getRole({ vendorId: req.vendorId, id: req.params.id, companyMasterData: req.companyMasterData });
        return sendResult(res, result);
    } catch (err) {
        logException('Error while fetching the role', err);
    }
};

// POST /api/roles
const createRole = async (req, res) => {
    try {
        const result = await roleService.createRole({ ...vendorData(req), userId: req.user._id, data: req.body });
        return respond(res, result, { vendorId: req.vendorId });
    } catch (err) {
        logException('Error while creating the role', err);
    }
};

// PUT /api/roles/:id
const updateRole = async (req, res) => {
    try {
        const result = await roleService.updateRole({ ...vendorData(req), userId: req.user._id, id: req.params.id, data: req.body });
        return respond(res, result, { vendorId: req.vendorId, roleId: req.params.id });
    } catch (err) {
        logException('Error while updating the role', err);
    }
};

// PATCH /api/roles/:id/status
const setRoleStatus = async (req, res) => {
    try {
        const result = await roleService.setRoleStatus({ vendorId: req.vendorId, userId: req.user._id, id: req.params.id, isActive: req.body.isActive });
        return respond(res, result, { vendorId: req.vendorId, roleId: req.params.id });
    } catch (err) {
        logException('Error while changing the role status', err);
    }
};

// DELETE /api/roles/:id
const deleteRole = async (req, res) => {
    try {
        const result = await roleService.deleteRole({ vendorId: req.vendorId, userId: req.user._id, id: req.params.id });
        return respond(res, result, { vendorId: req.vendorId, roleId: req.params.id });
    } catch (err) {
        logException('Error while deleting the role', err);
    }
};

// POST /api/roles/bulk
const bulkUpdateRoles = async (req, res) => {
    try {
        const result = await roleService.bulkUpdateRoles({ vendorId: req.vendorId, userId: req.user._id, ...req.body });
        return respond(res, result, { vendorId: req.vendorId, action: req.body.action });
    } catch (err) {
        logException('Error while updating several roles', err);
    }
};

module.exports = {
    getFormData,
    listRoles,
    getRole,
    createRole,
    updateRole,
    setRoleStatus,
    deleteRole,
    bulkUpdateRoles
};
