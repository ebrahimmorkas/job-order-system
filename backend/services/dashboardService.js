const JobOrder = require('../models/JobOrder');
const common = require('../utils/common');
const { FIXED_STEPS } = require('../constants/stepConstants');
const { DASHBOARD_LIMITS, WORK_STATES } = require('../constants/dashboardConstants');

// The dashboards, worked out from the job orders' work in one read:
//   GET /api/dashboard        - the owner (or a user with Dashboard): the
//                               whole vendor's work, who is on what, workload,
//                               latest step changes
//   GET /api/my-work/summary  - a user's own work (myWorkService)

const DAY_MS = 24 * 60 * 60 * 1000;
const idOf = (value) => String(value);

const WORK_FIELDS = 'jobOrderNumber masters.name masters.values.valueId masters.values.name masters.values.assignedAt masters.values.completeIn masters.values.dueAt masters.values.assignedTo.userId masters.values.assignedTo.name masters.values.assignedTo.startedAt masters.values.assignedTo.dueAt masters.values.assignedTo.step masters.values.assignedTo.history';

// The job orders worth reading: someone's work isn't completed, or a step
// changed since `since` (for "completed this week" and the latest activity).
const workFilterOf = ({ vendorId, userId = null, since }) => {
    try {
        const person = userId ? { userId } : {};
        return {
            vendorId,
            status: 'A',
            $or: [
                { 'masters.values.assignedTo': { $elemMatch: { ...person, 'step.fixedStep': { $ne: FIXED_STEPS.COMPLETED } } } },
                { 'masters.values.assignedTo': { $elemMatch: { ...person, 'step.at': { $gte: since } } } }
            ]
        };
    } catch (err) {
        throw err;
    }
};

// Everyone's work on these job orders, one entry per person per value:
// its state now (notStarted / inProgress / onHold / completed) and whether
// it is past its due time.
const workItemsOf = (jobOrders, now) => {
    try {
        const items = [];
        for (const jobOrder of jobOrders) {
            for (const master of jobOrder.masters) {
                for (const value of master.values) {
                    for (const person of value.assignedTo || []) {
                        const fixedStep = person.step?.fixedStep;
                        const state = fixedStep === FIXED_STEPS.COMPLETED ? WORK_STATES.COMPLETED
                            : fixedStep === FIXED_STEPS.HOLD ? WORK_STATES.ON_HOLD
                                : person.step ? WORK_STATES.IN_PROGRESS : WORK_STATES.NOT_STARTED;
                        const dueAt = person.dueAt ?? value.dueAt ?? null;
                        const { history, ...step } = person.step || {};
                        items.push({
                            jobOrderId: jobOrder._id,
                            jobOrderNumber: jobOrder.jobOrderNumber,
                            masterName: master.name,
                            valueId: value.valueId,
                            valueName: value.name,
                            userId: person.userId,
                            userName: person.name,
                            step: person.step ? step : null,
                            history: person.history || [],
                            state,
                            assignedAt: value.assignedAt ?? null,
                            completeIn: value.completeIn ?? null,
                            startedAt: person.startedAt ?? null,
                            dueAt,
                            isOverdue: state !== WORK_STATES.COMPLETED && !!dueAt && new Date(dueAt) < now
                        });
                    }
                }
            }
        }
        return items;
    } catch (err) {
        throw err;
    }
};

// How many of each, among the work not completed; completed = this week.
const totalsOf = (items, weekAgo) => {
    try {
        const totals = { open: 0, notStarted: 0, inProgress: 0, onHold: 0, overdue: 0, completedThisWeek: 0 };
        for (const item of items) {
            if (item.state === WORK_STATES.COMPLETED) {
                if (item.step?.at && new Date(item.step.at) >= weekAgo) totals.completedThisWeek++;
                continue;
            }
            totals.open++;
            totals[item.state]++;
            if (item.isOverdue) totals.overdue++;
        }
        return totals;
    } catch (err) {
        throw err;
    }
};

// Overdue first, then the soonest due; no due time last.
const byUrgency = (a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    if (!a.dueAt || !b.dueAt) return (a.dueAt ? 0 : 1) - (b.dueAt ? 0 : 1);
    return new Date(a.dueAt) - new Date(b.dueAt);
};

const publicItemOf = ({ history, state, ...item }) => ({ ...item, state });

// GET /api/dashboard
const getDashboard = async ({ vendorId }) => {
    try {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
        const activitySince = new Date(now.getTime() - DASHBOARD_LIMITS.ACTIVITY_DAYS * DAY_MS);
        const [jobOrderCount, createdThisWeek, jobOrders] = await Promise.all([
            JobOrder.countDocuments({ vendorId, status: 'A' }),
            JobOrder.countDocuments({ vendorId, status: 'A', createdAt: { $gte: weekAgo } }),
            JobOrder.find(workFilterOf({ vendorId, since: activitySince })).select(WORK_FIELDS).lean()
        ]);
        const items = workItemsOf(jobOrders, now);
        const open = items.filter((item) => item.state !== WORK_STATES.COMPLETED).sort(byUrgency);

        // Workload: each person's open work by state (overdue counted as overdue only).
        const people = new Map();
        for (const item of open) {
            const key = idOf(item.userId);
            if (!people.has(key)) people.set(key, { userId: item.userId, name: item.userName, notStarted: 0, inProgress: 0, onHold: 0, overdue: 0, total: 0 });
            const person = people.get(key);
            person[item.isOverdue ? 'overdue' : item.state]++;
            person.total++;
        }
        const workload = [...people.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

        // The latest step changes.
        const activity = [];
        for (const item of items) {
            for (const entry of item.history) {
                if (new Date(entry.at) < activitySince) continue;
                activity.push({
                    jobOrderId: item.jobOrderId, jobOrderNumber: item.jobOrderNumber, valueName: item.valueName, userName: item.userName,
                    step: { name: entry.name, fixedStep: entry.fixedStep, percent: entry.percent, holdReason: entry.holdReason }, at: entry.at
                });
            }
        }
        activity.sort((a, b) => new Date(b.at) - new Date(a.at));

        return common.returnResult(true, 200, 'Dashboard fetched successfully.', {
            now,
            totals: { jobOrders: jobOrderCount, createdThisWeek, ...totalsOf(items, weekAgo) },
            working: open.slice(0, DASHBOARD_LIMITS.WORKING).map(publicItemOf),
            workingTotal: open.length,
            workload: workload.slice(0, DASHBOARD_LIMITS.WORKLOAD),
            workloadTotal: workload.length,
            activity: activity.slice(0, DASHBOARD_LIMITS.ACTIVITY)
        });
    } catch (err) {
        throw err;
    }
};

// GET /api/my-work/summary - the user's own work: how many of each and what is due next.
const getMySummary = async ({ vendorId, userId }) => {
    try {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
        const jobOrders = await JobOrder.find(workFilterOf({ vendorId, userId, since: weekAgo })).select(WORK_FIELDS).lean();
        const me = idOf(userId);
        const items = workItemsOf(jobOrders, now).filter((item) => idOf(item.userId) === me);
        const open = items.filter((item) => item.state !== WORK_STATES.COMPLETED).sort(byUrgency);
        return common.returnResult(true, 200, 'Your work summary fetched successfully.', {
            now,
            totals: totalsOf(items, weekAgo),
            next: open.slice(0, DASHBOARD_LIMITS.MY_NEXT).map(({ userId: ignored, userName, ...item }) => publicItemOf(item))
        });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    getDashboard,
    getMySummary
};
