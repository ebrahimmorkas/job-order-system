const Joi = require('joi');
const { STORAGE_PROVIDERS, ACCOUNT_NOTES_MAX_LENGTH } = require('../../constants/storageConstants');

// A vendor's storage accounts, as written in seeds/private/storageCredentials.json
// and saved by scripts/manageVendorStorageCredentials.js:
//   { "image": { "cloudinary": { accountEmail, notes?, cloudName, apiKey, apiSecret } } }
// Only the areas / providers given are saved; the rest are left as they are.

// Every account names the email it was signed up with (the platform owner's
// own reference - the same account may be shared by several vendors).
const reference = {
    accountEmail: Joi.string().trim().lowercase().email().max(254).required().label('accountEmail'),
    notes: Joi.string().trim().max(ACCOUNT_NOTES_MAX_LENGTH).allow('').label('notes')
};

const text = (label, max = 200) => Joi.string().trim().min(1).max(max).required().label(label);

const cloudinaryAccount = Joi.object({
    ...reference,
    // Cloud names: lowercase letters, digits, hyphens and underscores.
    cloudName: Joi.string().trim().pattern(/^[a-z0-9_-]{1,100}$/).required().label('cloudName'),
    apiKey: Joi.string().trim().pattern(/^\d{6,30}$/).required().label('apiKey'),
    apiSecret: text('apiSecret', 100)
});

const awsAccount = Joi.object({
    ...reference,
    accessKeyId: Joi.string().trim().pattern(/^[A-Z0-9]{16,128}$/).required().label('accessKeyId'),
    secretAccessKey: text('secretAccessKey', 128),
    region: Joi.string().trim().pattern(/^[a-z]{2}(-[a-z]+)+-\d$/).required().label('region'),
    // S3 bucket naming rules.
    bucket: Joi.string().trim().pattern(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/).required().label('bucket')
});

const r2Account = Joi.object({
    ...reference,
    accountId: Joi.string().trim().pattern(/^[a-f0-9]{32}$/).required().label('accountId'),
    accessKeyId: text('accessKeyId', 128),
    secretAccessKey: text('secretAccessKey', 128),
    bucket: Joi.string().trim().pattern(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/).required().label('bucket'),
    endpoint: Joi.string().trim().uri({ scheme: ['https'] }).label('endpoint'),
    publicUrl: Joi.string().trim().uri({ scheme: ['https'] }).required().label('publicUrl')
});

const areaAccounts = Joi.object({
    [STORAGE_PROVIDERS.CLOUDINARY]: cloudinaryAccount,
    [STORAGE_PROVIDERS.AWS]: awsAccount,
    [STORAGE_PROVIDERS.R2]: r2Account
}).min(1);

const storageCredentialsSchema = Joi.object({
    image: areaAccounts
}).min(1).required();

module.exports = {
    storageCredentialsSchema
};
