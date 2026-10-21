const { STORAGE_PROVIDERS } = require('../../constants/storageConstants');

// Every provider implements the same interface:
//   upload(buffer, meta, credentials) -> Promise<{ url, key }>
//   delete(key, credentials) -> Promise<void>
// meta = { vendorId, module, extension, mimeType }. credentials come from
// storageCredentialsService - providers never read .env themselves.
//
// Each provider (and its SDK - the AWS and Cloudinary ones are large) is
// loaded the first time it is used, so a server that only ever uses one
// provider never holds the others in memory.
const loaders = {
    [STORAGE_PROVIDERS.CLOUDINARY]: () => require('./cloudinaryProvider'),
    [STORAGE_PROVIDERS.AWS]: () => require('./s3Provider').createProvider(STORAGE_PROVIDERS.AWS),
    [STORAGE_PROVIDERS.R2]: () => require('./s3Provider').createProvider(STORAGE_PROVIDERS.R2),
    [STORAGE_PROVIDERS.LOCAL]: () => require('./localProvider')
};
const loaded = {};

const getProvider = (providerName) => {
    try {
        if (!loaders[providerName]) {
            throw new Error(`Unsupported storage provider: ${providerName}`);
        }
        loaded[providerName] ??= loaders[providerName]();
        return loaded[providerName];
    } catch (err) {
        throw err;
    }
};

module.exports = { getProvider };
