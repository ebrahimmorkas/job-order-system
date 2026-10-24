const dashboardService = require('../services/dashboardService');
const { sendResult } = require('../utils/common');
const { logException } = require('../utils/logger');

// GET /api/dashboard
const getDashboard = async (req, res) => {
    try {
        const result = await dashboardService.getDashboard({ vendorId: req.vendorId });
        return sendResult(res, result);
    } catch (err) {
        logException('Error while fetching the dashboard', err);
    }
};

// GET /api/my-work/summary
const getMySummary = async (req, res) => {
    try {
        const result = await dashboardService.getMySummary({ vendorId: req.vendorId, userId: req.user._id });
        return sendResult(res, result);
    } catch (err) {
        logException('Error while fetching your work summary', err);
    }
};

module.exports = {
    getDashboard,
    getMySummary
};
