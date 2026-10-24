const JobOrder = require('../models/JobOrder');
const logger = require('../utils/logger');
const notificationService = require('./notificationService');
const { FIXED_STEPS } = require('../constants/stepConstants');
const { OVERDUE_CHECK_MS, OVERDUE_LOOKBACK_MS } = require('../constants/notificationConstants');

// Every OVERDUE_CHECK_MS: work that went past its due time (in the last
// OVERDUE_LOOKBACK_MS) and isn't completed is announced to the owner - once
// only, so a restart or the next look never repeats it (the key holds the
// due time: a new due time is announced again when it passes).

let timer = null;

const look = async () => {
    try {
        const now = new Date();
        const range = { $gt: new Date(now.getTime() - OVERDUE_LOOKBACK_MS), $lte: now };
        const jobOrders = await JobOrder.find({ status: 'A', $or: [{ 'masters.values.dueAt': range }, { 'masters.values.assignedTo.dueAt': range }] })
            .select('vendorId jobOrderNumber masters.values.valueId masters.values.name masters.values.dueAt masters.values.assignedTo.userId masters.values.assignedTo.name masters.values.assignedTo.dueAt masters.values.assignedTo.step.fixedStep')
            .lean();

        const byVendor = new Map();
        for (const jobOrder of jobOrders) {
            for (const master of jobOrder.masters) {
                for (const value of master.values) {
                    for (const person of value.assignedTo) {
                        const dueAt = person.dueAt ?? value.dueAt;
                        if (!dueAt || dueAt <= range.$gt || dueAt > now || person.step?.fixedStep === FIXED_STEPS.COMPLETED) continue;
                        const vendorId = String(jobOrder.vendorId);
                        if (!byVendor.has(vendorId)) byVendor.set(vendorId, []);
                        byVendor.get(vendorId).push({
                            jobOrderId: jobOrder._id,
                            jobOrderNumber: jobOrder.jobOrderNumber,
                            valueName: value.name,
                            workerName: person.name,
                            key: `overdue:${jobOrder._id}:${value.valueId}:${person.userId}:${new Date(dueAt).getTime()}`
                        });
                    }
                }
            }
        }
        for (const [vendorId, overdue] of byVendor) await notificationService.announceOverdue({ vendorId, overdue });
    } catch (err) {
        throw err;
    }
};

const start = () => {
    try {
        if (timer) return;
        // A background job: a failed look is logged and the next one tries again.
        const lookSafely = () => look().catch((err) => logger.logWarning('Looking for overdue work failed', err));
        timer = setInterval(lookSafely, OVERDUE_CHECK_MS);
        timer.unref();
        lookSafely();
    } catch (err) {
        throw err;
    }
};

module.exports = {
    start
};
