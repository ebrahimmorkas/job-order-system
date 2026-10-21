const mongoose = require('mongoose');

// Full change history of every model that uses models/plugins/auditPlugin.js -
// one record per create / update / status change / delete. Written only by
// that plugin, never by a controller or service, and append-only: a history
// that can be edited is not a history (see the guards at the bottom).
const AUDIT_ACTIONS = ['CREATE', 'UPDATE', 'ACTIVATE', 'INACTIVATE', 'DELETE', 'RESTORE', 'HARD_DELETE'];

const auditLogSchema = new mongoose.Schema({
    // null for documents that belong to no vendor (e.g. WebsiteMaster).
    vendorId: {
        type: mongoose.Types.ObjectId,
        default: null
    },
    // The model name, e.g. 'CompanySettings'.
    collectionName: {
        type: String,
        required: true
    },
    documentId: {
        type: mongoose.Types.ObjectId,
        required: true
    },
    // DELETE = soft delete (status 'D'), HARD_DELETE = removed from the database,
    // RESTORE = brought back from status 'D'.
    action: {
        type: String,
        enum: AUDIT_ACTIONS,
        required: true
    },
    // Only the fields that changed, as dotted paths (e.g. 'address.city').
    // CREATE lists every field with from: null; HARD_DELETE every field with
    // to: null, so the deleted document can still be read here. Sensitive
    // fields (passwords, tokens...) show that they changed but never their value.
    changes: [{
        _id: false,
        field: { type: String, required: true },
        from: { type: mongoose.Schema.Types.Mixed, default: null },
        to: { type: mongoose.Schema.Types.Mixed, default: null }
    }],
    // null = done by the system (a seed, a background job), not a logged-in user.
    changedBy: {
        type: mongoose.Types.ObjectId,
        default: null
    },
    // Same requestId as the ErrorLog and the X-Request-Id response header, so
    // a change can be traced back to the exact request.
    requestId: {
        type: String,
        default: null
    },
    ip: {
        type: String,
        default: null
    },
    userAgent: {
        type: String,
        default: null
    }
}, {
    // Records are never updated, so only createdAt (= when the change happened).
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false
});

// "History of this document", "everything this vendor changed", "everything this user did".
auditLogSchema.index({ collectionName: 1, documentId: 1, createdAt: -1 });
auditLogSchema.index({ vendorId: 1, createdAt: -1 });
auditLogSchema.index({ changedBy: 1, createdAt: -1 });

// Append-only: any attempt to edit or delete history through Mongoose fails.
const refuse = function () {
    throw new Error('AuditLog is append-only - records cannot be updated or deleted');
};
['updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndReplace', 'replaceOne',
    'deleteOne', 'deleteMany', 'findOneAndDelete'].forEach((op) => auditLogSchema.pre(op, refuse));
auditLogSchema.pre('save', function () {
    if (!this.isNew) refuse();
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
module.exports.AUDIT_ACTIONS = AUDIT_ACTIONS;
