const mongoose = require('mongoose');
const auditPlugin = require('./plugins/auditPlugin');
const cacheInvalidationPlugin = require('./plugins/cacheInvalidationPlugin');
const redisKeys = require('../utils/redisKeys');
const { VALID_STORAGE_PROVIDERS, ACCOUNT_NOTES_MAX_LENGTH } = require('../constants/storageConstants');

// The vendor's own storage accounts (storageCredentials below). Secrets are
// encrypted with common.encryptSecret and only ever decrypted inside
// services/storageCredentialsService.js. The plain fields (cloudName, region,
// bucket, accountId, endpoint, publicUrl) are not secret - they appear in
// every public file URL. accountEmail / notes are only the platform owner's
// reference (which email the provider account was signed up with); two
// vendors may be given the same account.
const accountReferenceFields = {
    accountEmail: { type: String, trim: true, lowercase: true, maxlength: 254 },
    notes: { type: String, trim: true, maxlength: ACCOUNT_NOTES_MAX_LENGTH }
};

const cloudinaryAccountSchema = new mongoose.Schema({
    ...accountReferenceFields,
    cloudName: String,
    encryptedApiKey: String,
    encryptedApiSecret: String
}, { _id: false });

const awsAccountSchema = new mongoose.Schema({
    ...accountReferenceFields,
    encryptedAccessKeyId: String,
    encryptedSecretAccessKey: String,
    region: String,
    bucket: String
}, { _id: false });

const r2AccountSchema = new mongoose.Schema({
    ...accountReferenceFields,
    accountId: String,
    encryptedAccessKeyId: String,
    encryptedSecretAccessKey: String,
    bucket: String,
    endpoint: String,
    publicUrl: String
}, { _id: false });

// One account per provider, so switching imageService (e.g. cloudinary ->
// aws) does not lose the other account.
const storageAreaAccountsSchema = new mongoose.Schema({
    cloudinary: { type: cloudinaryAccountSchema, default: undefined },
    aws: { type: awsAccountSchema, default: undefined },
    r2: { type: r2AccountSchema, default: undefined }
}, { _id: false });

// Per-vendor entitlements, set by the platform owner - e.g. the vendor paid
// for a feature, so it is switched on for them here. A feature works only
// when it is on here AND in WebsiteMaster (see checkFeatureOnOrOff in
// utils/common.js). A new feature flag must be added to both schemas.
const companyMasterSchema = new mongoose.Schema({
    vendorId: {
        type: mongoose.Types.ObjectId,
        required: true,
        unique: true
    },
    // Shown when a feature is on in WebsiteMaster but switched off for this
    // vendor - unless checkFeatureOnOrOff is given its own customMessage.
    featureDisabledForVendorMessage: {
        type: String,
        trim: true,
        default: 'This feature is not enabled for your account. Please contact support.'
    },

    // ---- Storage ----------------------------------------------------------
    // Where this vendor's images go. null = WebsiteMaster.mainImageService
    // (with the platform's own account). Overridden for everyone while
    // WebsiteMaster.enforceMainImageService is on.
    imageService: {
        type: String,
        enum: [...VALID_STORAGE_PROVIDERS, null],
        default: null
    },
    // Largest image this vendor may upload, in MB.
    maxImageUploadSizeMB: {
        type: Number,
        min: 0.1,
        max: 20,
        default: 2
    },
    // The vendor's own accounts, per area and provider. NEVER loaded unless a
    // query asks for it ('+storageCredentials...'), never serialised (see the
    // transforms below) and never written to the audit history.
    storageCredentials: {
        type: new mongoose.Schema({
            image: { type: storageAreaAccountsSchema, default: undefined }
        }, { _id: false }),
        select: false,
        default: undefined
    }
}, {
  timestamps: true
});

// Defence in depth: even a document loaded with the credentials can never
// carry them into an API response, the Redis cache or a log.
const stripStorageCredentials = (doc, ret) => {
    delete ret.storageCredentials;
    return ret;
};
companyMasterSchema.set('toJSON', { transform: stripStorageCredentials });
companyMasterSchema.set('toObject', { transform: stripStorageCredentials });

companyMasterSchema.plugin(auditPlugin, { exclude: ['storageCredentials'] });
companyMasterSchema.plugin(cacheInvalidationPlugin, { key: (vendorId) => redisKeys.companyMaster(vendorId) });

module.exports = mongoose.model('CompanyMaster', companyMasterSchema);
