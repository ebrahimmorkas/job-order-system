const masterService = require('../services/masterService');
const { sendResult } = require('../utils/common');
const { logInfo, logException } = require('../utils/logger');

// Every route here already passed: login, owner role, the master feature
// switch and the Joi validation (routes/masterRoutes.js).

const respond = (res, result, meta) => {
    if (result.isSuccess) logInfo(1, 0, result.message, meta);
    else logInfo(0, 1, result.message, meta);
    return sendResult(res, result);
};

// GET /api/masters
const listMasters = async (req, res) => {
    try {
        const result = await masterService.listMasters({ vendorId: req.vendorId, ...req.query, companyMasterData: req.companyMasterData });
        return sendResult(res, result);
    } catch (err) {
        logException('Error while fetching masters', err);
    }
};

// GET /api/masters/:id
const getMaster = async (req, res) => {
    try {
        const result = await masterService.getMaster({ vendorId: req.vendorId, id: req.params.id, companyMasterData: req.companyMasterData });
        return sendResult(res, result);
    } catch (err) {
        logException('Error while fetching the master', err);
    }
};

// POST /api/masters
const createMaster = async (req, res) => {
    try {
        const result = await masterService.createMaster({
            vendorId: req.vendorId, userId: req.user._id, data: req.body, companyMasterData: req.companyMasterData
        });
        return respond(res, result, { vendorId: req.vendorId });
    } catch (err) {
        logException('Error while creating the master', err);
    }
};

// PUT /api/masters/:id
const updateMaster = async (req, res) => {
    try {
        const result = await masterService.updateMaster({
            vendorId: req.vendorId, userId: req.user._id, id: req.params.id, data: req.body, companyMasterData: req.companyMasterData
        });
        return respond(res, result, { vendorId: req.vendorId, masterId: req.params.id });
    } catch (err) {
        logException('Error while updating the master', err);
    }
};

// PATCH /api/masters/:id/status
const setMasterStatus = async (req, res) => {
    try {
        const result = await masterService.setMasterStatus({
            vendorId: req.vendorId, userId: req.user._id, id: req.params.id, isActive: req.body.isActive
        });
        return respond(res, result, { vendorId: req.vendorId, masterId: req.params.id });
    } catch (err) {
        logException('Error while changing the master status', err);
    }
};

// DELETE /api/masters/:id
const deleteMaster = async (req, res) => {
    try {
        const result = await masterService.deleteMaster({ vendorId: req.vendorId, userId: req.user._id, id: req.params.id });
        return respond(res, result, { vendorId: req.vendorId, masterId: req.params.id });
    } catch (err) {
        logException('Error while deleting the master', err);
    }
};

// POST /api/masters/bulk
const bulkUpdateMasters = async (req, res) => {
    try {
        const result = await masterService.bulkUpdateMasters({ vendorId: req.vendorId, userId: req.user._id, ...req.body });
        return respond(res, result, { vendorId: req.vendorId, action: req.body.action });
    } catch (err) {
        logException('Error while updating several masters', err);
    }
};

// PATCH /api/masters/:id/move
const moveMaster = async (req, res) => {
    try {
        const result = await masterService.moveMaster({ vendorId: req.vendorId, userId: req.user._id, id: req.params.id, direction: req.body.direction });
        return respond(res, result, { vendorId: req.vendorId, masterId: req.params.id });
    } catch (err) {
        logException('Error while moving the master', err);
    }
};

// PATCH /api/masters/:id/values/:valueId/status
const setValueStatus = async (req, res) => {
    try {
        const result = await masterService.setValueStatus({
            vendorId: req.vendorId, userId: req.user._id, id: req.params.id, valueId: req.params.valueId, isActive: req.body.isActive
        });
        return respond(res, result, { vendorId: req.vendorId, masterId: req.params.id, valueId: req.params.valueId });
    } catch (err) {
        logException('Error while changing a master value status', err);
    }
};

// PATCH /api/masters/:id/values/:valueId/move
const moveValue = async (req, res) => {
    try {
        const result = await masterService.moveValue({
            vendorId: req.vendorId, userId: req.user._id, id: req.params.id, valueId: req.params.valueId, direction: req.body.direction
        });
        return respond(res, result, { vendorId: req.vendorId, masterId: req.params.id, valueId: req.params.valueId });
    } catch (err) {
        logException('Error while moving a master value', err);
    }
};

// DELETE /api/masters/:id/values/:valueId
const deleteValue = async (req, res) => {
    try {
        const result = await masterService.deleteValue({
            vendorId: req.vendorId, userId: req.user._id, id: req.params.id, valueId: req.params.valueId
        });
        return respond(res, result, { vendorId: req.vendorId, masterId: req.params.id, valueId: req.params.valueId });
    } catch (err) {
        logException('Error while deleting a master value', err);
    }
};

module.exports = {
    listMasters,
    getMaster,
    createMaster,
    updateMaster,
    setMasterStatus,
    deleteMaster,
    bulkUpdateMasters,
    moveMaster,
    setValueStatus,
    moveValue,
    deleteValue
};
