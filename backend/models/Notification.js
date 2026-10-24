const mongoose = require('mongoose');
const { NOTIFICATION_TYPE_VALUES } = require('../constants/notificationConstants');

// A notification in someone's bell (see services/notificationService.js).
// Written by the server only, so it carries no audit history; it deletes
// itself when expiresAt passes (TTL index).
const notificationSchema = mongoose.Schema({
    vendorId: {
        type: mongoose.Types.ObjectId,
        required: true
    },
    // Who it is for.
    userId: {
        type: mongoose.Types.ObjectId,
        required: true
    },
    type: {
        type: String,
        enum: NOTIFICATION_TYPE_VALUES,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        default: null
    },
    // The job order it is about (opens it from the bell).
    jobOrderId: {
        type: mongoose.Types.ObjectId,
        default: null
    },
    // Announced once only: the same key is never sent again (overdue work).
    key: {
        type: String,
        default: null
    },
    readAt: {
        type: Date,
        default: null
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 }
    }
}, {
    timestamps: true
});

// The bell: someone's newest first, and how many are unread.
notificationSchema.index({ vendorId: 1, userId: 1, createdAt: -1 });
notificationSchema.index({ vendorId: 1, userId: 1, readAt: 1 });
notificationSchema.index({ vendorId: 1, key: 1 }, { partialFilterExpression: { key: { $type: 'string' } } });

module.exports = mongoose.model('Notification', notificationSchema);
