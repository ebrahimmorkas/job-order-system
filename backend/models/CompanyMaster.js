const mongoose = require('mongoose');
const { CONTROL_TYPE_VALUES } = require('../constants/controlConstants');
const { FIXED_STEP_VALUES, STEP_NAME_MAX_LENGTH } = require('../constants/stepConstants');

// A whole number of at least `min`, or null (= no limit).
const wholeNumberOrNull = (field, min = 0) => ({
    type: Number,
    min,
    validate: { validator: (value) => value === null || Number.isInteger(value), message: `${field} must be a whole number` },
    default: null
});
const auditPlugin = require('./plugins/auditPlugin');
const cacheInvalidationPlugin = require('./plugins/cacheInvalidationPlugin');
const redisKeys = require('../utils/redisKeys');
const { VALID_STORAGE_PROVIDERS, ACCOUNT_NOTES_MAX_LENGTH, IMAGE_FORMAT_VALUES, MAX_IMAGE_UPLOAD_MB } = require('../constants/storageConstants');
const { SERVICE_MESSAGE_MAX_LENGTH } = require('../constants/serviceStatusConstants');

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
// One step of assigned work (see constants/stepConstants.js): a fixed step
// of the app (fixedStep) or one of the vendor's own (fixedStep null, name
// required). A fixed step without a name shows its usual name.
const stepSchema = new mongoose.Schema({
    fixedStep: { type: String, enum: [...FIXED_STEP_VALUES, null], default: null },
    name: { type: String, trim: true, maxlength: STEP_NAME_MAX_LENGTH, default: null },
    // 1 = first; the order the steps are offered in.
    precedence: { type: Number, required: true }
}, { _id: false });

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

    // ---- Master module ----------------------------------------------------
    // The vendor's own dropdown lists (models/Master.js). Off until the
    // platform owner switches it on for this vendor.
    isMasterModuleFeatureOn: {
        type: Boolean,
        default: false
    },
    // Only matters while isMasterModuleFeatureOn is off: the job order form
    // still gets the vendor's masters (GET /api/masters/for-job-order), while
    // the Masters page and every other master action stay off.
    fetchMastersEvenWhenBitIsOff: {
        type: Boolean,
        default: false
    },
    // How many masters / values per master the vendor may have (active +
    // inactive; deleted ones don't count). No default on purpose: set per
    // vendor - while empty, nothing can be created.
    numberOfMastersAllowed: {
        type: Number,
        min: 0,
        validate: { validator: (value) => value === null || Number.isInteger(value), message: 'numberOfMastersAllowed must be a whole number' },
        default: null
    },
    numberOfValuesAllowedInMaster: {
        type: Number,
        min: 0,
        validate: { validator: (value) => value === null || Number.isInteger(value), message: 'numberOfValuesAllowedInMaster must be a whole number' },
        default: null
    },

    // ---- Controls ---------------------------------------------------------
    // Fields the vendor adds to the job order form (models/Control.js). Off
    // until the platform owner switches it on for this vendor.
    isControlsFeatureOn: {
        type: Boolean,
        default: false
    },
    // Which control types the vendor gets: null = all of them, [] = none,
    // otherwise only those listed. Controls of a type taken away are hidden
    // everywhere (kept in the database; they come back if it is given again).
    // Only matters while isControlsFeatureOn is off: the job order form still
    // gets the vendor's controls of the assigned types (GET
    // /api/controls/for-job-order), while the Controls page and every other
    // control action stay off.
    fetchControlsEvenWhenBitIsOff: {
        type: Boolean,
        default: false
    },
    assignedControls: {
        type: [{ type: String, enum: CONTROL_TYPE_VALUES }],
        default: null
    },
    // How many controls of each type the vendor may have (active + inactive;
    // deleted ones don't count). null = no limit.
    numberOfControlsAllowed: {
        textfield: wholeNumberOrNull('numberOfControlsAllowed.textfield'),
        textarea: wholeNumberOrNull('numberOfControlsAllowed.textarea'),
        checkbox: wholeNumberOrNull('numberOfControlsAllowed.checkbox'),
        radio: wholeNumberOrNull('numberOfControlsAllowed.radio')
    },
    // Longest text allowed (null = no limit): typed into a textfield /
    // textarea (and its default text), a radio choice, a checkbox's text.
    maxLengthOfTextfieldControl: wholeNumberOrNull('maxLengthOfTextfieldControl', 1),
    maxLengthOfTextareaControl: wholeNumberOrNull('maxLengthOfTextareaControl', 1),
    maxLengthOfRadioButtonText: wholeNumberOrNull('maxLengthOfRadioButtonText', 1),
    maxLengthOfCheckboxText: wholeNumberOrNull('maxLengthOfCheckboxText', 1),
    // Most choices in one radio group (null = no limit).
    numberOfRadioButtonsAllowedInGroup: wholeNumberOrNull('numberOfRadioButtonsAllowedInGroup', 2),
    // Longest label (the question above the control) and placeholder (grey
    // hint text) the vendor may set (null = no limit). A checkbox's label is
    // its text: maxLengthOfCheckboxText.
    maxTextForLabelInTextfieldControl: wholeNumberOrNull('maxTextForLabelInTextfieldControl', 1),
    maxTextForPlaceholderInTextfieldControl: wholeNumberOrNull('maxTextForPlaceholderInTextfieldControl', 1),
    maxTextForLabelInTextareaControl: wholeNumberOrNull('maxTextForLabelInTextareaControl', 1),
    maxTextForPlaceholderInTextareaControl: wholeNumberOrNull('maxTextForPlaceholderInTextareaControl', 1),
    maxTextForLabelInRadioButtonControl: wholeNumberOrNull('maxTextForLabelInRadioButtonControl', 1),

    // ---- Tax --------------------------------------------------------------
    // Tax on the job order, the Tax tab of Company Settings and the "Include
    // this price in tax" tick of a price text field. Off until the platform
    // owner switches it on for this vendor.
    isTaxFeatureOn: {
        type: Boolean,
        default: false
    },
    // The countries whose tax system applies to the vendor (CountryMaster
    // ids). None = no tax at all. With two or more, the job order asks which
    // country it is for.
    assignedCountries: {
        type: [{ type: mongoose.Types.ObjectId, ref: 'CountryMaster' }],
        default: []
    },

    // ---- Roles (RBAC) -----------------------------------------------------
    // Role Master and Users. Off until the platform owner switches it on for
    // this vendor (also needs WebsiteMaster.isRBACFeatureOn).
    isRBACFeatureOn: {
        type: Boolean,
        default: false
    },
    // Most roles the vendor can create (active + inactive). null = no limit.
    numberOfRoleCreationAllowed: wholeNumberOrNull('numberOfRoleCreationAllowed', 1),
    // Most users the vendor can add (active + inactive; the owner not
    // counted). null = no limit.
    numberOfUsersAllowed: wholeNumberOrNull('numberOfUsersAllowed', 1),
    // A user can get extra access of their own (modules / masters, each with
    // its own dates) on top of their roles.
    isRoleAssignmentOnUserModuleAllowed: {
        type: Boolean,
        default: false
    },
    // A user can get several roles; otherwise at most one.
    isAssigningSeveralRolesAllowed: {
        type: Boolean,
        default: false
    },

    // ---- Layout Master ------------------------------------------------------
    // Print layouts for job orders. Off until the platform owner switches it
    // on for this vendor (also needs WebsiteMaster.isLayoutMasterFeatureOn).
    isLayoutMasterFeatureOn: {
        type: Boolean,
        default: false
    },
    // Most layouts the vendor can create (active + inactive). null = no limit.
    numberOfLayoutsAllowed: wholeNumberOrNull('numberOfLayoutsAllowed', 1),
    // Text formatting in layouts (font, size, bold, italic, underline,
    // alignment, colour). Off = every text in the standard font.
    isControlFeatureInLayoutOn: {
        type: Boolean,
        default: false
    },

    // ---- Maintenance and payment --------------------------------------------
    // On: this vendor's app (owner and users, even the login page) shows the
    // maintenance page, with maintenanceMessage when set.
    underMaintenance: {
        type: Boolean,
        default: false
    },
    maintenanceMessage: {
        type: String,
        trim: true,
        maxlength: SERVICE_MESSAGE_MAX_LENGTH,
        default: null
    },
    // On: after logging in, the owner sees the payment page (with
    // paymentMessage when set); users only "unavailable, contact your owner".
    paymentNotDone: {
        type: Boolean,
        default: false
    },
    paymentMessage: {
        type: String,
        trim: true,
        maxlength: SERVICE_MESSAGE_MAX_LENGTH,
        default: null
    },

    // ---- Steps of assigned work ----------------------------------------------
    // A user given work moves it through steps (Start, In progress...). Off
    // until the platform owner switches it on for this vendor (also needs
    // WebsiteMaster.isStepFeatureOn).
    isStepFeatureOn: {
        type: Boolean,
        default: false
    },
    // Most steps the vendor gets, fixed ones included - the first ones by
    // precedence. null = no limit.
    numberOfStepsAllowed: wholeNumberOrNull('numberOfStepsAllowed', 1),
    // The vendor's steps, set by the platform owner, e.g.
    // [{ fixedStep: 'completed', precedence: 1 }, { name: 'Packing', precedence: 2 },
    //  { fixedStep: 'start', precedence: 3 }]
    steps: {
        type: [stepSchema],
        default: []
    },

    // ---- Images on job orders --------------------------------------------
    // Photos added to a job order. Off until the platform owner switches it
    // on for this vendor (also needs WebsiteMaster.isImageUploadFeatureOn).
    isImageUploadFeatureOn: {
        type: Boolean,
        default: false
    },
    // Most images on one job order. null = no limit of the vendor's own
    // (the server still takes at most MAX_IMAGES_PER_REQUEST).
    numberOfImageUploadAllowed: wholeNumberOrNull('numberOfImageUploadAllowed', 1),
    // Which formats may be uploaded: some of jpeg, png, webp, gif.
    // null = all of them. The size limit is maxImageUploadSizeMB below.
    imageFormatsAllowed: {
        type: [{ type: String, enum: IMAGE_FORMAT_VALUES }],
        default: null,
        validate: {
            validator: (value) => value === null || (value.length > 0 && new Set(value).size === value.length),
            message: 'imageFormatsAllowed must list at least one format, each once (or be null for all)'
        }
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
    // Largest image this vendor may upload (logo and job order images), in
    // MB. null = no limit of the vendor's own (the server's ceiling,
    // MAX_IMAGE_UPLOAD_MB, still applies).
    maxImageUploadSizeMB: {
        type: Number,
        min: 0.1,
        max: MAX_IMAGE_UPLOAD_MB,
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
