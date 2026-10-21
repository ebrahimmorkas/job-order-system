const mongoose = require('mongoose');

// One document per error, written only by utils/logger.js (logException /
// logWarning) - never through an API. Read directly from the database by the
// developer, using the reference the error page shows (requestId).
const errorLogSchema = new mongoose.Schema({
    vendorId: {
        type: mongoose.Types.ObjectId,
        required: true,
        index: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    // ERROR = logException(): the request failed and the user was shown the
    // error page with this record's requestId as the reference.
    // WARNING = logWarning(): something went wrong but the request carried on.
    severity: {
        type: String,
        enum: ['ERROR', 'WARNING'],
        default: 'ERROR',
        index: true
    },
    errorName: {
        type: String,
        default: null
    },
    errorMessage: {
        type: String,
        default: null
    },
    stack: {
        type: String,
        default: null
    },
    environment: {
        type: String,
        default: 'development'
    },
    server: {
        hostname: { type: String, default: null },
        pid: { type: Number, default: null }
    },
    // The same id as the X-Request-Id response header (middlewares/requestContext.js)
    // and AuditLog.requestId.
    requestId: {
        type: String,
        default: null,
        index: true
    },
    // params / query / body have secrets replaced (utils/sensitiveFields.js).
    request: {
        method: { type: String, default: null },
        url: { type: String, default: null },
        ip: { type: String, default: null },
        userAgent: { type: String, default: null },
        params: { type: mongoose.Schema.Types.Mixed, default: null },
        query: { type: mongoose.Schema.Types.Mixed, default: null },
        body: { type: mongoose.Schema.Types.Mixed, default: null }
    },
    user: {
        userId: { type: mongoose.Types.ObjectId, default: null },
        role: { type: String, default: null }
    },
    // Any extra fields the caller passed besides the error itself,
    // e.g. logException('Error saving job', { jobId, error }) keeps jobId here.
    additionalData: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    // Set by hand by the developer while working through errors.
    resolutionStatus: {
        type: String,
        enum: ['NEW', 'ACKNOWLEDGED', 'RESOLVED', 'IGNORED'],
        default: 'NEW',
        required: true,
        index: true
    },
    resolutionNotes: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

errorLogSchema.index({ vendorId: 1, createdAt: -1 });
errorLogSchema.index({ vendorId: 1, resolutionStatus: 1 });

module.exports = mongoose.model('ErrorLog', errorLogSchema);
