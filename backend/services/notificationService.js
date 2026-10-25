const Notification = require('../models/Notification');
const User = require('../models/User');
const common = require('../utils/common');
const logger = require('../utils/logger');
const realtimeService = require('./realtimeService');
const { mastersOfItems, withItemLabel } = require('../utils/jobOrderItems');
const { ROLES } = require('../constants/roleConstants');
const { FIXED_STEPS } = require('../constants/stepConstants');
const { NOTIFICATION_TYPES, NOTIFICATION_KEEP_DAYS, REALTIME_EVENTS } = require('../constants/notificationConstants');

// The bell: notifications saved per person and sent at once to their open
// pages (services/realtimeService.js). Who gets what:
//   a user  - work given to them, taken away (also a cancelled job order),
//             its time changed;
//   the owner - someone moved their work to a step, put it on hold,
//             completed it, or it went past its due time (overdueWatcher).
// The job order pages are told to load again too.

const idOf = (value) => String(value);
const DAY_MS = 24 * 60 * 60 * 1000;
const PUBLIC_FIELDS = '_id type title message jobOrderId readAt createdAt';

const publicOf = ({ _id, type, title, message, jobOrderId, readAt, createdAt }) => ({ _id, type, title, message, jobOrderId, readAt, createdAt });

// Saves the notifications and sends each to its person.
// items: [{ userId, type, title, message, key }]
const send = async ({ vendorId, jobOrderId = null, items }) => {
    try {
        if (items.length === 0) return;
        const expiresAt = new Date(Date.now() + NOTIFICATION_KEEP_DAYS * DAY_MS);
        const docs = await Notification.insertMany(
            items.map(({ userId, type, title, message = null, key = null }) => ({ vendorId, userId, type, title, message, jobOrderId, key, expiresAt }))
        );
        for (const doc of docs) realtimeService.toUsers([doc.userId], REALTIME_EVENTS.NOTIFICATION, { notification: publicOf(doc) });
    } catch (err) {
        throw err;
    }
};

// After the job order is saved: a failed notification must not fail the
// request, so it runs on its own and is only logged.
const inBackground = (label, task) => {
    try {
        task().catch((err) => logger.logWarning(label, err));
    } catch (err) {
        logger.logWarning(label, err);
    }
};

const ownerIdsOf = async (vendorId) => {
    try {
        const owners = await User.find({ vendorId, role: ROLES.OWNER, status: 'A' }).select('_id').lean();
        return owners.map((owner) => owner._id);
    } catch (err) {
        throw err;
    }
};

// Everyone given work on a job order's items:
// "itemId|valueId|userId" -> { userId, valueName (with its item), completeIn, dueAt }.
const peopleOf = (items = []) => {
    try {
        const people = new Map();
        for (const { itemId, itemLabel, master } of mastersOfItems(items)) {
            for (const value of master.values || []) {
                for (const person of value.assignedTo || []) {
                    people.set(`${idOf(itemId)}|${idOf(value.valueId)}|${idOf(person.userId)}`, {
                        userId: idOf(person.userId),
                        valueName: withItemLabel(value.name, itemLabel),
                        completeIn: value.completeIn ?? null,
                        dueAt: person.dueAt ?? value.dueAt ?? null
                    });
                }
            }
        }
        return people;
    } catch (err) {
        throw err;
    }
};

const timeOf = (date) => (date ? new Date(date).getTime() : null);
const sameDuration = (a, b) => (a?.amount ?? null) === (b?.amount ?? null) && (a?.unit ?? null) === (b?.unit ?? null);

// Per person: the values given, taken away and whose time changed.
const workChangesOf = (before, after) => {
    try {
        const changes = new Map();
        const add = (userId, kind, valueName) => {
            if (!changes.has(userId)) changes.set(userId, { given: [], taken: [], timeChanged: [] });
            changes.get(userId)[kind].push(valueName);
        };
        for (const [key, person] of after) {
            const old = before.get(key);
            if (!old) add(person.userId, 'given', person.valueName);
            else if (!sameDuration(old.completeIn, person.completeIn) || timeOf(old.dueAt) !== timeOf(person.dueAt)) add(person.userId, 'timeChanged', person.valueName);
        }
        for (const [key, person] of before) {
            if (!after.has(key)) add(person.userId, 'taken', person.valueName);
        }
        return changes;
    } catch (err) {
        throw err;
    }
};

/**
 * A job order was created, saved or cancelled: tells the people whose work
 * changed, and every open page of the vendor to load again.
 * before / after: the job order's items (with masters, values and assignedTo).
 */
const announceJobOrderSaved = async ({ vendorId, jobOrderId, jobOrderNumber, before = [], after = [], isCancelled = false }) => {
    try {
        const was = peopleOf(before);
        const now = isCancelled ? new Map() : peopleOf(after);
        const items = [];
        for (const [userId, change] of workChangesOf(was, now)) {
            if (change.given.length > 0) items.push({ userId, type: NOTIFICATION_TYPES.WORK_GIVEN, title: `New work on ${jobOrderNumber}`, message: change.given.join(', ') });
            if (change.taken.length > 0) {
                items.push({
                    userId,
                    type: NOTIFICATION_TYPES.WORK_TAKEN,
                    title: isCancelled ? `Job order ${jobOrderNumber} cancelled` : `Work taken off ${jobOrderNumber}`,
                    message: change.taken.join(', ')
                });
            }
            if (change.timeChanged.length > 0) items.push({ userId, type: NOTIFICATION_TYPES.TIME_CHANGED, title: `Time changed on ${jobOrderNumber}`, message: change.timeChanged.join(', ') });
        }
        await send({ vendorId, jobOrderId, items });

        realtimeService.toVendor(vendorId, REALTIME_EVENTS.JOB_ORDERS_CHANGED, { jobOrderId });
        const everyone = [...new Set([...was.values(), ...peopleOf(after).values()].map((person) => person.userId))];
        realtimeService.toUsers(everyone, REALTIME_EVENTS.MY_WORK_CHANGED, { jobOrderId });
    } catch (err) {
        throw err;
    }
};

// What the owner reads about a step change.
const stepMessageOf = (workerName, step) => {
    try {
        if (step.fixedStep === FIXED_STEPS.COMPLETED) return { type: NOTIFICATION_TYPES.COMPLETED, message: `${workerName} completed it.` };
        if (step.fixedStep === FIXED_STEPS.HOLD) return { type: NOTIFICATION_TYPES.ON_HOLD, message: `${workerName} put it on hold${step.holdReason ? `: ${step.holdReason}` : '.'}` };
        const percent = step.percent !== null && step.percent !== undefined ? ` (${step.percent}%)` : '';
        return { type: NOTIFICATION_TYPES.STEP_CHANGED, message: `${workerName} moved it to ${step.name}${percent}.` };
    } catch (err) {
        throw err;
    }
};

/**
 * Someone moved their work to a step: tells the owner, and the vendor's
 * open pages (and the person's own other pages) to load again.
 */
const announceStep = async ({ vendorId, jobOrderId, jobOrderNumber, valueName, workerId, workerName, step }) => {
    try {
        const ownerIds = await ownerIdsOf(vendorId);
        const { type, message } = stepMessageOf(workerName, step);
        await send({ vendorId, jobOrderId, items: ownerIds.map((userId) => ({ userId, type, title: `${jobOrderNumber} - ${valueName}`, message })) });
        realtimeService.toVendor(vendorId, REALTIME_EVENTS.JOB_ORDERS_CHANGED, { jobOrderId });
        realtimeService.toUsers([workerId], REALTIME_EVENTS.MY_WORK_CHANGED, { jobOrderId });
    } catch (err) {
        throw err;
    }
};

/**
 * Work that went past its due time (services/overdueWatcher.js), each
 * announced to the owner once only (by its key).
 * overdue: [{ jobOrderId, jobOrderNumber, valueName, workerName, key }]
 */
const announceOverdue = async ({ vendorId, overdue }) => {
    try {
        const announced = new Set(await Notification.distinct('key', { vendorId, key: { $in: overdue.map((entry) => entry.key) } }));
        const fresh = overdue.filter((entry) => !announced.has(entry.key));
        if (fresh.length === 0) return;
        const ownerIds = await ownerIdsOf(vendorId);
        for (const entry of fresh) {
            await send({
                vendorId,
                jobOrderId: entry.jobOrderId,
                items: ownerIds.map((userId) => ({
                    userId, type: NOTIFICATION_TYPES.OVERDUE, title: `${entry.jobOrderNumber} - ${entry.valueName}`, message: `${entry.workerName}'s work is overdue.`, key: entry.key
                }))
            });
        }
    } catch (err) {
        throw err;
    }
};

// GET /api/notifications - newest first; `before` (a createdAt) loads older ones.
const listNotifications = async ({ vendorId, userId, before, limit }) => {
    try {
        const filter = { vendorId, userId, ...(before && { createdAt: { $lt: before } }) };
        const [notifications, unreadCount] = await Promise.all([
            Notification.find(filter).select(PUBLIC_FIELDS).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).lean(),
            Notification.countDocuments({ vendorId, userId, readAt: null })
        ]);
        return common.returnResult(true, 200, 'Notifications fetched successfully.', {
            notifications: notifications.slice(0, limit),
            hasMore: notifications.length > limit,
            unreadCount
        });
    } catch (err) {
        throw err;
    }
};

// PATCH /api/notifications/read - the ones listed (none = all) are read.
const markRead = async ({ vendorId, userId, ids }) => {
    try {
        const filter = { vendorId, userId, readAt: null, ...(ids && { _id: { $in: ids } }) };
        await Notification.updateMany(filter, { $set: { readAt: new Date() } });
        const unreadCount = await Notification.countDocuments({ vendorId, userId, readAt: null });
        // Their other tabs show it too.
        realtimeService.toUsers([userId], REALTIME_EVENTS.NOTIFICATIONS_READ, { unreadCount });
        return common.returnResult(true, 200, 'Marked as read.', { unreadCount });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    inBackground,
    announceJobOrderSaved,
    announceStep,
    announceOverdue,
    listNotifications,
    markRead
};
