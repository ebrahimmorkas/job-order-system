const mongoose = require('mongoose');
const AuditLog = require('../AuditLog');
const logger = require('../../utils/logger');
const { getRequestContext } = require('../../middlewares/requestContext');
const { isSensitiveField, REDACTED } = require('../../utils/sensitiveFields');

// Adds the standard audit fields to a model and records every change it goes
// through in AuditLog.
//
//   schema.plugin(auditPlugin);                          // vendor-scoped model
//   schema.plugin(auditPlugin, { vendorScoped: false }); // platform-wide (WebsiteMaster)
//   schema.plugin(auditPlugin, { exclude: ['cachedTotal'] }); // fields kept out of the history
//
// The fields on the document hold only the LATEST state (who last updated it,
// who last deactivated it...); AuditLog holds the full history.
//
// Who made the change: the `auditUserId` query option when given (the
// utils/common.js helpers pass their userId this way), or doc.$locals.auditUserId
// for doc.save(), else the logged-in user of the current request (req.user,
// via middlewares/requestContext.js), else null = the system.
//
// Covered: Model.create / doc.save / insertMany, and the query methods
// findOneAndUpdate, updateOne, updateMany, findOneAndReplace, replaceOne,
// findOneAndDelete, deleteOne, deleteMany. NOT covered: bulkWrite and raw
// driver calls (Model.collection.*) - don't use them on audited models.

// Kept out of the change list: they describe the change itself (who/when),
// which AuditLog already records in changedBy / createdAt.
const AUDIT_META_FIELDS = new Set([
    '_id', '__v', 'createdAt', 'updatedAt',
    'createdBy', 'updatedBy', 'deletedBy', 'deletedDate',
    'activeMarkedBy', 'activeMarkedDate', 'inActiveMarkedBy', 'inactiveMarkedDate'
]);


const UPDATE_OPS = ['findOneAndUpdate', 'updateOne', 'updateMany', 'findOneAndReplace', 'replaceOne'];
const DELETE_OPS = ['findOneAndDelete', 'deleteOne', 'deleteMany'];
const MANY_OPS = new Set(['updateMany', 'deleteMany']);

const auditFields = {
    status: {
        type: String,
        enum: ['I', 'A', 'D'],
        default: 'A',
        required: true
    },
    createdBy: { type: mongoose.Types.ObjectId, default: null },
    updatedBy: { type: mongoose.Types.ObjectId, default: null },
    deletedBy: { type: mongoose.Types.ObjectId, default: null },
    deletedDate: { type: Date, default: null },
    activeMarkedBy: { type: mongoose.Types.ObjectId, default: null },
    activeMarkedDate: { type: Date, default: null },
    inActiveMarkedBy: { type: mongoose.Types.ObjectId, default: null },
    inactiveMarkedDate: { type: Date, default: null }
};

const isPlainObject = (value) => !!value && Object.getPrototypeOf(value) === Object.prototype;

// { a: { b: 1 }, c: 2 } -> { 'a.b': 1, c: 2 }. Arrays, dates and ObjectIds are leaf values.
const flatten = (obj, prefix = '', out = {}) => {
    for (const [key, value] of Object.entries(obj || {})) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (isPlainObject(value) && Object.keys(value).length > 0) {
            flatten(value, path, out);
        } else {
            out[path] = value;
        }
    }
    return out;
};

// JSON form compares dates, ObjectIds, arrays and nested values by content.
const sameValue = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const isExcluded = (path, exclude) => {
    if (AUDIT_META_FIELDS.has(path.split('.')[0])) return true;
    return exclude.some((field) => path === field || path.startsWith(`${field}.`));
};

// Only the fields whose value differs between the two versions.
const diff = (before, after, exclude) => {
    const flatBefore = flatten(before);
    const flatAfter = flatten(after);
    const changes = [];

    for (const field of new Set([...Object.keys(flatBefore), ...Object.keys(flatAfter)])) {
        if (isExcluded(field, exclude) || sameValue(flatBefore[field], flatAfter[field])) continue;
        // A change to a secret (utils/sensitiveFields.js) is recorded, but never its value.
        const isSensitive = isSensitiveField(field.split('.').pop());
        changes.push({
            field,
            from: isSensitive ? REDACTED : (flatBefore[field] ?? null),
            to: isSensitive ? REDACTED : (flatAfter[field] ?? null)
        });
    }
    return changes;
};

const resolveAction = (before, after) => {
    if (!after) return 'HARD_DELETE';
    if (!before) return 'CREATE';
    if (before.status !== after.status) {
        if (after.status === 'D') return 'DELETE';
        if (before.status === 'D') return 'RESTORE';
        return after.status === 'I' ? 'INACTIVATE' : 'ACTIVATE';
    }
    return 'UPDATE';
};

const currentUserId = () => getRequestContext()?.req?.user?._id || null;

// Never throws: the change itself is already saved, so a failed history write
// is logged loudly instead of failing the request that made the change.
const recordChange = async (modelName, before, after, changedBy, exclude) => {
    try {
        const action = resolveAction(before, after);
        const changes = diff(before, after, exclude);
        // Saved, but nothing that matters actually changed (e.g. same value written again).
        if (action === 'UPDATE' && changes.length === 0) return;

        const doc = after || before;
        const ctx = getRequestContext();
        await AuditLog.create({
            vendorId: doc.vendorId || ctx?.req?.vendorId || null,
            collectionName: modelName,
            documentId: doc._id,
            action,
            changes,
            changedBy: changedBy || null,
            requestId: ctx?.requestId || null,
            ip: ctx?.req?.ip || null,
            userAgent: ctx?.req?.headers?.['user-agent'] || null
        });
    } catch (err) {
        logger.logWarning('Failed to write AuditLog', { modelName, documentId: (after || before)?._id, err });
    }
};

// Every schema the plugin was applied to - checkModelsAudited() reads it.
const auditedSchemas = new WeakSet();

const auditPlugin = (schema, { vendorScoped = true, exclude = [] } = {}) => {
    auditedSchemas.add(schema);

    // bulkWrite skips every hook below, so its changes would never reach
    // AuditLog. Refused outright instead of silently going unrecorded.
    schema.static('bulkWrite', function () {
        throw new Error(`bulkWrite is not allowed on ${this.modelName}: it bypasses the audit history. Use create/insertMany/updateMany/deleteMany instead.`);
    });

    // Fields a model already defines itself (e.g. a unique vendorId) are kept as they are.
    const fields = { ...auditFields };
    if (vendorScoped) {
        // No index of its own: the { vendorId, status } index below already
        // serves every query on vendorId, and each extra index costs RAM and
        // slows every write.
        fields.vendorId = { type: mongoose.Types.ObjectId, required: true };
    }
    for (const [path, definition] of Object.entries(fields)) {
        if (!schema.path(path)) schema.add({ [path]: definition });
    }
    schema.set('timestamps', true);
    if (vendorScoped) {
        // What getAll and most list pages filter on.
        schema.index({ vendorId: 1, status: 1 });
    }

    // ---- Model.create / doc.save -------------------------------------------
    schema.pre('save', async function () {
        const changedBy = this.$locals.auditUserId || currentUserId();
        if (changedBy) {
            if (this.isNew && !this.createdBy) this.createdBy = changedBy;
            this.updatedBy = changedBy;
        }
        this.$locals.auditChangedBy = changedBy;
        this.$locals.auditWasNew = this.isNew;
        // One read per save of an existing document - far cheaper than keeping
        // a copy of every document on every read just in case it gets saved.
        this.$locals.auditBefore = this.isNew
            ? null
            : await this.constructor.findById(this._id).session(this.$session()).lean();
    });

    schema.post('save', async function (doc) {
        await recordChange(this.constructor.modelName, doc.$locals.auditBefore,
            doc.toObject({ depopulate: true }), doc.$locals.auditChangedBy, exclude);
    });

    // ---- insertMany --------------------------------------------------------
    schema.post('insertMany', async function (docs) {
        const changedBy = currentUserId();
        for (const doc of [].concat(docs)) {
            await recordChange(this.modelName, null, doc.toObject ? doc.toObject({ depopulate: true }) : doc, changedBy, exclude);
        }
    });

    // ---- Query updates and deletes -----------------------------------------
    // Reads the matching documents BEFORE the change, so the post hook can
    // compare them with what they became (or record what was deleted).
    async function captureBefore() {
        const options = this.getOptions();
        const changedBy = options.auditUserId || currentUserId();
        this._audit = { changedBy };

        if (changedBy && UPDATE_OPS.includes(this.op)) {
            if (this.op.includes('Replace') || this.op === 'replaceOne') {
                this.setUpdate({ ...this.getUpdate(), updatedBy: changedBy });
            } else {
                this.set('updatedBy', changedBy);
            }
        }

        const filter = this.getFilter();
        const session = options.session || null;
        this._audit.before = MANY_OPS.has(this.op)
            ? await this.model.find(filter).session(session).lean()
            : [await this.model.findOne(filter, null, { sort: options.sort }).session(session).lean()].filter(Boolean);
    }

    async function recordUpdates(result) {
        if (!this._audit) return;
        const { before, changedBy } = this._audit;
        const modelName = this.model.modelName;
        const session = this.getOptions().session || null;

        const ids = before.map((doc) => doc._id);
        // An upsert that created a new document instead of updating one. A
        // findOneAndUpdate upsert with returnDocument 'before' returns null, so
        // the new document is then looked up by the same filter.
        let upsertedId = result?.upsertedId || (before.length === 0 && result?._id) || null;
        if (!upsertedId && before.length === 0 && this.getOptions().upsert) {
            upsertedId = (await this.model.findOne(this.getFilter(), { _id: 1 }).session(session).lean())?._id || null;
        }
        if (upsertedId) ids.push(upsertedId);
        if (ids.length === 0) return;

        const after = await this.model.find({ _id: { $in: ids } }).session(session).lean();
        const afterById = new Map(after.map((doc) => [doc._id.toString(), doc]));

        for (const oldDoc of before) {
            const newDoc = afterById.get(oldDoc._id.toString());
            if (newDoc) await recordChange(modelName, oldDoc, newDoc, changedBy, exclude);
        }
        if (upsertedId && afterById.has(upsertedId.toString())) {
            const created = afterById.get(upsertedId.toString());
            if (created.createdBy == null && changedBy) {
                await this.model.updateOne({ _id: created._id }, { $set: { createdBy: changedBy } }, { auditSkip: true }).session(session);
            }
            await recordChange(modelName, null, created, changedBy, exclude);
        }
    }

    async function recordDeletes() {
        if (!this._audit) return;
        const { before, changedBy } = this._audit;
        for (const oldDoc of before) {
            await recordChange(this.model.modelName, oldDoc, null, changedBy, exclude);
        }
    }

    // auditSkip is internal only (setting createdBy on an upserted document
    // above must not produce a second history record).
    const unlessSkipped = (fn) => async function (...args) {
        if (this.getOptions().auditSkip) return;
        return fn.apply(this, args);
    };

    schema.pre([...UPDATE_OPS, ...DELETE_OPS], { document: false, query: true }, unlessSkipped(captureBefore));
    schema.post(UPDATE_OPS, { document: false, query: true }, unlessSkipped(recordUpdates));
    schema.post(DELETE_OPS, { document: false, query: true }, unlessSkipped(recordDeletes));
};

// Models that deliberately keep no audit history: logs that are themselves a
// record, and short-lived technical data.
const AUDIT_EXEMPT_MODELS = new Set(['AuditLog', 'ErrorLog', 'RefreshToken', 'LoginAttempt']);

// Run once at startup, after every model is loaded: throws if a model is
// missing the plugin, so a new model can't quietly go without its history.
const checkModelsAudited = () => {
    const missing = mongoose.modelNames().filter((name) =>
        !AUDIT_EXEMPT_MODELS.has(name) && !auditedSchemas.has(mongoose.model(name).schema));
    if (missing.length > 0) {
        throw new Error(`Missing auditPlugin on: ${missing.join(', ')}. Add schema.plugin(auditPlugin), or list the model in AUDIT_EXEMPT_MODELS (models/plugins/auditPlugin.js).`);
    }
};

module.exports = auditPlugin;
module.exports.checkModelsAudited = checkModelsAudited;
module.exports.diff = diff;
module.exports.auditFields = auditFields;
