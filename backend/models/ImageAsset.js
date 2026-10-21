const mongoose = require('mongoose');
const auditPlugin = require('./plugins/auditPlugin');
const { VALID_STORAGE_PROVIDERS, IMAGE_MIME_TYPES } = require('../constants/storageConstants');

// One document per uploaded image, wherever it is stored (services/imageUploadService.js).
const imageAssetSchema = new mongoose.Schema({
    // What it belongs to, e.g. 'companyLogo' (IMAGE_MODULES). A free string so
    // new modules need no schema change.
    module: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50
    },
    // The provider that holds the file.
    provider: {
        type: String,
        enum: VALID_STORAGE_PROVIDERS,
        required: true
    },
    url: {
        type: String,
        required: true
    },
    // Provider-specific id to delete / replace the file later (Cloudinary
    // public_id, S3/R2 object key, or the path under the local upload folder).
    key: {
        type: String,
        required: true
    },
    // Which account of that provider holds it (never a secret), e.g.
    // "cloudinary:<cloudName>" or "local" - see buildStorageAccountId.
    storageAccount: {
        type: String,
        default: null
    },
    mimeType: {
        type: String,
        enum: IMAGE_MIME_TYPES
    },
    // Bytes.
    size: {
        type: Number,
        min: 0
    }
}, {
    timestamps: true
});

// The one query it gets: a vendor's images of a module.
imageAssetSchema.index({ vendorId: 1, module: 1, status: 1 });

imageAssetSchema.plugin(auditPlugin);

module.exports = mongoose.model('ImageAsset', imageAssetSchema);
