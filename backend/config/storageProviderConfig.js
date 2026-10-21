// The PLATFORM's own storage accounts (the website owner's), read from .env -
// one per provider.
//
// A vendor normally uploads to their OWN account (CompanyMaster.storageCredentials).
// These are used only when WebsiteMaster forces every vendor onto a provider
// the vendor did not choose (enforceMainImageService), or when the vendor has
// no imageService of their own - see services/storageCredentialsService.js.
//
// local has no account: it is this server's own disk, shared by every vendor
// (each vendor's files sit under their own <vendorId>/ folder).

const path = require('path');

const storageProviderConfig = {
    cloudinary: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        apiSecret: process.env.CLOUDINARY_API_SECRET
    },
    aws: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION,
        bucket: process.env.AWS_S3_BUCKET
    },
    r2: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        accountId: process.env.R2_ACCOUNT_ID,
        bucket: process.env.R2_BUCKET,
        endpoint: process.env.R2_ENDPOINT,
        publicUrl: process.env.R2_PUBLIC_URL
    },
    local: {
        // Absolute, so it doesn't depend on the folder the server is started from.
        basePath: path.resolve(__dirname, '..', process.env.LOCAL_STORAGE_PATH || 'uploads'),
        // Relative URL: the same file works on every vendor's domain. server.js
        // serves this path (nginx should serve it directly in production).
        baseUrl: '/uploads'
    }
};

module.exports = storageProviderConfig;
