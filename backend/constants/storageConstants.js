// Single source of truth for media storage. Each vendor has its OWN storage
// account per area, saved encrypted in CompanyMaster.storageCredentials - see
// services/storageCredentialsService.js.

// What kind of upload it is. Each area has its own provider choice
// (CompanyMaster.imageService ...) and its own credentials. Only images exist
// so far; a new area (videos, files) adds an entry here and in AREA_SERVICE_FIELDS.
const STORAGE_AREAS = {
    IMAGE: 'image'
};

const VALID_STORAGE_AREAS = Object.values(STORAGE_AREAS);

const STORAGE_PROVIDERS = {
    CLOUDINARY: 'cloudinary',
    AWS: 'aws',
    R2: 'r2',
    LOCAL: 'local'
};

const VALID_STORAGE_PROVIDERS = Object.values(STORAGE_PROVIDERS);

// Providers that need an account. 'local' writes to this server's own disk.
const CREDENTIAL_PROVIDERS = [STORAGE_PROVIDERS.CLOUDINARY, STORAGE_PROVIDERS.AWS, STORAGE_PROVIDERS.R2];

// Per provider: every field a complete account needs, and which of them are
// encrypted at rest (common.encryptSecret). The rest are not secret - they
// appear in every public file URL - and stay readable so a stored file can be
// matched back to the account that holds it (buildStorageAccountId).
const PROVIDER_CREDENTIAL_FIELDS = {
    [STORAGE_PROVIDERS.CLOUDINARY]: {
        required: ['cloudName', 'apiKey', 'apiSecret'],
        encrypted: ['apiKey', 'apiSecret'],
        optional: []
    },
    [STORAGE_PROVIDERS.AWS]: {
        required: ['accessKeyId', 'secretAccessKey', 'region', 'bucket'],
        encrypted: ['accessKeyId', 'secretAccessKey'],
        optional: []
    },
    [STORAGE_PROVIDERS.R2]: {
        required: ['accountId', 'accessKeyId', 'secretAccessKey', 'bucket', 'publicUrl'],
        encrypted: ['accessKeyId', 'secretAccessKey'],
        // Defaults to https://<accountId>.r2.cloudflarestorage.com when unset.
        optional: ['endpoint']
    }
};

// Kept next to every account for the platform owner's own reference - the
// email the provider account was signed up with, and free-text notes. Never
// sent to a provider. Two vendors may share the same account.
const ACCOUNT_NOTES_MAX_LENGTH = 500;

// Names shown in messages.
const PROVIDER_LABELS = {
    [STORAGE_PROVIDERS.CLOUDINARY]: 'Cloudinary',
    [STORAGE_PROVIDERS.AWS]: 'Amazon S3',
    [STORAGE_PROVIDERS.R2]: 'Cloudflare R2',
    [STORAGE_PROVIDERS.LOCAL]: 'Local storage'
};

// Where each area's provider choice lives on CompanyMaster / WebsiteMaster.
const AREA_SERVICE_FIELDS = {
    [STORAGE_AREAS.IMAGE]: { vendorService: 'imageService', mainService: 'mainImageService', enforce: 'enforceMainImageService' }
};

// Images: what may be uploaded. Checked against the file's real content
// (utils/imageType.js), not just its name. SVG is deliberately excluded - it
// can carry scripts.
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const IMAGE_EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

// The formats a vendor can be limited to (CompanyMaster.imageFormatsAllowed),
// with their type and the name shown in messages.
const IMAGE_FORMATS = {
    jpeg: { mimeType: 'image/jpeg', label: 'JPG' },
    png: { mimeType: 'image/png', label: 'PNG' },
    webp: { mimeType: 'image/webp', label: 'WebP' },
    gif: { mimeType: 'image/gif', label: 'GIF' }
};
const IMAGE_FORMAT_VALUES = Object.keys(IMAGE_FORMATS);

// Size of one image, in MB: the server's hard ceiling (also the limit of a
// vendor whose maxImageUploadSizeMB is null) and the limit of a vendor whose
// CompanyMaster predates the field.
const MAX_IMAGE_UPLOAD_MB = 20;
const DEFAULT_IMAGE_UPLOAD_MB = 2;
// Most images one request may carry (and one job order may hold while the
// vendor's numberOfImageUploadAllowed is null).
const MAX_IMAGES_PER_REQUEST = 50;

// What each stored image belongs to (ImageAsset.module).
const IMAGE_MODULES = {
    COMPANY_LOGO: 'companyLogo',
    JOB_ORDER: 'jobOrder'
};

module.exports = {
    STORAGE_AREAS,
    VALID_STORAGE_AREAS,
    STORAGE_PROVIDERS,
    VALID_STORAGE_PROVIDERS,
    CREDENTIAL_PROVIDERS,
    PROVIDER_CREDENTIAL_FIELDS,
    ACCOUNT_NOTES_MAX_LENGTH,
    PROVIDER_LABELS,
    AREA_SERVICE_FIELDS,
    IMAGE_MIME_TYPES,
    IMAGE_EXTENSIONS,
    IMAGE_FORMATS,
    IMAGE_FORMAT_VALUES,
    MAX_IMAGE_UPLOAD_MB,
    DEFAULT_IMAGE_UPLOAD_MB,
    MAX_IMAGES_PER_REQUEST,
    IMAGE_MODULES
};
