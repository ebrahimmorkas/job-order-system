const CompanyMaster = require('../models/CompanyMaster');
const storageProviderConfig = require('../config/storageProviderConfig');
const common = require('../utils/common');
const logger = require('../utils/logger');
const {
    STORAGE_PROVIDERS,
    VALID_STORAGE_AREAS,
    CREDENTIAL_PROVIDERS,
    PROVIDER_CREDENTIAL_FIELDS,
    PROVIDER_LABELS,
    AREA_SERVICE_FIELDS
} = require('../constants/storageConstants');

/*
| PER-VENDOR STORAGE ACCOUNTS
|
| Every vendor uploads to their OWN Cloudinary / S3 / R2 account, saved
| encrypted in CompanyMaster.storageCredentials (select: false). This service
| is the ONLY place those credentials are read and decrypted, and decrypted
| values only ever go straight into a provider call - never into a response,
| the Redis cache or a log. Several vendors may be given the same account.
|
| Which account an upload goes to (resolveUploadTarget):
|   - provider = WebsiteMaster.main<Area>Service when enforce<Area> is on,
|     else the vendor's own <area>Service, else main<Area>Service;
|   - the provider is the vendor's own <area>Service -> the vendor's own
|     account. Not set up -> refused with a clear message (no silent fallback);
|   - otherwise -> the platform's .env account.
|
| Which account an existing file is in (resolveAssetCredentials): the one
| whose id equals the asset's storageAccount.
*/

// Stored name of a field: secrets as encrypted<Field>, the rest as-is.
const storedFieldName = (provider, field) => {
    try {
        return PROVIDER_CREDENTIAL_FIELDS[provider].encrypted.includes(field)
            ? `encrypted${field.charAt(0).toUpperCase()}${field.slice(1)}`
            : field;
    } catch (err) {
        throw err;
    }
};

const hasValue = (value) => typeof value === 'string' && value.trim() !== '';

// True when every required field has a value. stored = true checks a stored
// (still encrypted) account without decrypting anything.
const isAccountComplete = (provider, account, stored = false) => {
    try {
        const fields = PROVIDER_CREDENTIAL_FIELDS[provider];
        if (!fields || !account) return false;
        return fields.required.every((field) => hasValue(account[stored ? storedFieldName(provider, field) : field]));
    } catch (err) {
        throw err;
    }
};

// The non-secret identity of an account - which cloud / bucket a file is in.
// Saved on every ImageAsset as storageAccount.
const buildStorageAccountId = (provider, credentials) => {
    try {
        if (provider === STORAGE_PROVIDERS.LOCAL) return STORAGE_PROVIDERS.LOCAL;
        if (!credentials) return null;
        if (provider === STORAGE_PROVIDERS.CLOUDINARY) return `cloudinary:${credentials.cloudName}`;
        if (provider === STORAGE_PROVIDERS.AWS) return `aws:${credentials.region}:${credentials.bucket}`;
        if (provider === STORAGE_PROVIDERS.R2) return `r2:${credentials.accountId}:${credentials.bucket}`;
        return null;
    } catch (err) {
        throw err;
    }
};

// The platform's .env account for a provider, or null when .env doesn't hold
// a complete one.
const getPlatformAccount = (provider) => {
    try {
        if (provider === STORAGE_PROVIDERS.LOCAL) return storageProviderConfig.local;
        const credentials = storageProviderConfig[provider];
        return isAccountComplete(provider, credentials) ? credentials : null;
    } catch (err) {
        throw err;
    }
};

// Plain account (validated by storageCredentialsValidations) -> the stored
// shape, every secret encrypted. accountEmail / notes are kept as they are.
const encryptAccount = (provider, plainAccount) => {
    try {
        const fields = PROVIDER_CREDENTIAL_FIELDS[provider];
        if (!fields) throw new Error(`Unsupported storage provider: ${provider}`);
        const stored = {};
        for (const [field, value] of Object.entries(plainAccount)) {
            if (value === undefined || value === null || value === '') continue;
            stored[storedFieldName(provider, field)] = fields.encrypted.includes(field) ? common.encryptSecret(value) : value;
        }
        return stored;
    } catch (err) {
        throw err;
    }
};

// Stored account -> plain credentials the provider needs (nothing else), or
// null when it isn't complete.
const decryptAccount = (provider, storedAccount) => {
    try {
        const fields = PROVIDER_CREDENTIAL_FIELDS[provider];
        if (!fields || !isAccountComplete(provider, storedAccount, true)) return null;
        const credentials = {};
        for (const field of [...fields.required, ...fields.optional]) {
            const value = storedAccount[storedFieldName(provider, field)];
            if (!hasValue(value)) continue;
            credentials[field] = fields.encrypted.includes(field) ? common.decryptSecret(value) : value;
        }
        return credentials;
    } catch (err) {
        throw err;
    }
};

// Only the one stored account asked for - straight from the DB (the cache
// never holds credentials), projected so nothing else is read.
const fetchVendorAccount = async (vendorId, area, provider) => {
    try {
        const path = `storageCredentials.${area}.${provider}`;
        // Inclusive projection of just this account ("+path" does not reach
        // inside the select:false parent).
        const companyMaster = await CompanyMaster.findOne({ vendorId }).select({ _id: 0, [path]: 1 }).lean();
        return decryptAccount(provider, companyMaster?.storageCredentials?.[area]?.[provider]);
    } catch (err) {
        throw err;
    }
};

// Which provider + account a new upload in this area goes to (rules at the
// top). Success meta: { provider, credentials, storageAccount }.
const resolveUploadTarget = async ({ area, vendorId, companyMasterData, websiteMasterData }) => {
    try {
        const serviceFields = AREA_SERVICE_FIELDS[area];
        if (!serviceFields) throw new Error(`Unsupported storage area: ${area}`);

        const vendorService = companyMasterData?.[serviceFields.vendorService] || null;
        const mainService = websiteMasterData?.[serviceFields.mainService] || null;
        const provider = websiteMasterData?.[serviceFields.enforce] === true ? mainService : (vendorService || mainService);

        if (!provider) {
            return common.returnResult(false, 400, `No ${area} storage has been set up for your account. Please contact support.`);
        }
        if (provider === STORAGE_PROVIDERS.LOCAL) {
            return common.returnResult(true, 200, 'Storage account resolved', {
                provider, credentials: storageProviderConfig.local, storageAccount: STORAGE_PROVIDERS.LOCAL
            });
        }
        if (!CREDENTIAL_PROVIDERS.includes(provider)) {
            return common.returnResult(false, 400, `Unsupported ${area} storage provider: ${provider}.`);
        }

        const label = PROVIDER_LABELS[provider];
        const isVendorAccount = provider === vendorService;
        const credentials = isVendorAccount ? await fetchVendorAccount(vendorId, area, provider) : getPlatformAccount(provider);
        if (!credentials) {
            logger.logInfo(0, 1, 'Storage account not set up', { vendorId, area, provider, isVendorAccount });
            return common.returnResult(false, 400, `The ${label} account for ${area} uploads has not been set up yet. Please contact support.`);
        }
        return common.returnResult(true, 200, 'Storage account resolved', {
            provider, credentials, storageAccount: buildStorageAccountId(provider, credentials)
        });
    } catch (err) {
        throw err;
    }
};

// Credentials of the account an existing asset is stored in, or null when no
// known account holds it any more (e.g. the vendor's account was changed).
// Checks the vendor's account for this area first, then the same provider in
// the other areas, then the platform's .env account. One DB read at most.
const resolveAssetCredentials = async ({ area, asset }) => {
    try {
        const provider = asset.provider;
        if (provider === STORAGE_PROVIDERS.LOCAL) return storageProviderConfig.local;
        if (!CREDENTIAL_PROVIDERS.includes(provider)) return null;

        const areas = [area, ...VALID_STORAGE_AREAS.filter((other) => other !== area)];
        // Inclusive projection: "+path" does not reach inside a select:false parent.
        const projection = { _id: 0 };
        for (const a of areas) projection[`storageCredentials.${a}.${provider}`] = 1;
        const companyMaster = await CompanyMaster.findOne({ vendorId: asset.vendorId }).select(projection).lean();
        for (const candidateArea of areas) {
            const credentials = decryptAccount(provider, companyMaster?.storageCredentials?.[candidateArea]?.[provider]);
            if (credentials && buildStorageAccountId(provider, credentials) === asset.storageAccount) return credentials;
        }

        const platform = getPlatformAccount(provider);
        return platform && buildStorageAccountId(provider, platform) === asset.storageAccount ? platform : null;
    } catch (err) {
        throw err;
    }
};

// Removes an asset's file from the account that holds it. When no known
// account holds it any more it is left in place and logged, so the caller's
// replace / delete still goes ahead.
const deleteStoredAsset = async ({ area, asset, getProvider }) => {
    try {
        const credentials = await resolveAssetCredentials({ area, asset });
        if (!credentials) {
            logger.logWarning('No storage account holds this file any more - left in place', {
                assetId: asset._id, vendorId: asset.vendorId, area, provider: asset.provider, storageAccount: asset.storageAccount
            });
            return false;
        }
        await getProvider(asset.provider).delete(asset.key, credentials);
        return true;
    } catch (err) {
        throw err;
    }
};

module.exports = {
    isAccountComplete,
    buildStorageAccountId,
    encryptAccount,
    resolveUploadTarget,
    deleteStoredAsset
};
