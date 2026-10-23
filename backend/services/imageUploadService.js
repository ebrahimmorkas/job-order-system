const ImageAsset = require('../models/ImageAsset');
const { getProvider } = require('./providers/providerFactory');
const storageCredentialsService = require('./storageCredentialsService');
const { STORAGE_AREAS, IMAGE_EXTENSIONS, IMAGE_MIME_TYPES, IMAGE_FORMATS, MAX_IMAGE_UPLOAD_MB, DEFAULT_IMAGE_UPLOAD_MB } = require('../constants/storageConstants');
const { detectImageType } = require('../utils/imageType');
const common = require('../utils/common');
const logger = require('../utils/logger');

// The vendor's size limit for one image, in MB: null = only the server's
// ceiling; missing (a CompanyMaster older than the field) = the old default.
const maxImageSizeMBOf = (companyMasterData) => {
    try {
        const own = companyMasterData?.maxImageUploadSizeMB;
        if (own === null) return MAX_IMAGE_UPLOAD_MB;
        return own ?? DEFAULT_IMAGE_UPLOAD_MB;
    } catch (err) {
        throw err;
    }
};

// "JPG, PNG or WebP"
const formatNames = (mimeTypes) => {
    try {
        const names = Object.values(IMAGE_FORMATS).filter((format) => mimeTypes.includes(format.mimeType)).map((format) => format.label);
        return names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}` : names.join('');
    } catch (err) {
        throw err;
    }
};

// Checks an uploaded image (from middlewares/imageUpload.js) against the
// vendor's size limit, its real content and the formats allowed.
// Success meta: { mimeType }.
const validateImage = (file, companyMasterData, { allowedMimeTypes = IMAGE_MIME_TYPES } = {}) => {
    try {
        if (!file) {
            return common.returnResult(false, 400, 'Please choose an image to upload.');
        }
        const maxSizeMB = maxImageSizeMBOf(companyMasterData);
        if (file.size > maxSizeMB * 1024 * 1024) {
            return common.returnResult(false, 400, `The image is larger than the allowed ${maxSizeMB} MB.`);
        }
        // The browser-sent type is only a claim - the bytes decide.
        const mimeType = detectImageType(file.buffer);
        if (!mimeType || !allowedMimeTypes.includes(mimeType)) {
            return common.returnResult(false, 400, `The file is not a valid ${formatNames(allowedMimeTypes)} image.`);
        }
        return common.returnResult(true, 200, 'Image is valid', { mimeType });
    } catch (err) {
        throw err;
    }
};

// Stores an image for a module and records it as an ImageAsset. Replacing an
// image: upload the new one, point the owner at it, THEN deleteImage the old
// one - so a failure part-way never leaves the owner pointing at a deleted file.
// Success meta: { image } (plain object).
const uploadImage = async ({ vendorId, userId, module, file, companyMasterData, websiteMasterData, allowedMimeTypes }) => {
    try {
        const validation = validateImage(file, companyMasterData, { allowedMimeTypes });
        if (!validation.isSuccess) return validation;
        const { mimeType } = validation.meta;

        const target = await storageCredentialsService.resolveUploadTarget({
            area: STORAGE_AREAS.IMAGE, vendorId, companyMasterData, websiteMasterData
        });
        if (!target.isSuccess) return target;
        const { provider, credentials, storageAccount } = target.meta;

        const { url, key } = await getProvider(provider).upload(file.buffer, {
            vendorId, module, mimeType, extension: IMAGE_EXTENSIONS[mimeType]
        }, credentials);

        const image = new ImageAsset({ vendorId, module, provider, url, key, storageAccount, mimeType, size: file.size });
        image.$locals.auditUserId = userId;
        await image.save();

        logger.logInfo(1, 0, 'Image uploaded', { vendorId, module, provider });
        return common.returnResult(true, 201, 'Image uploaded successfully.', { image: image.toObject() });
    } catch (err) {
        throw err;
    }
};

// Removes the file from its storage and marks the ImageAsset deleted. A
// missing image is not an error (already gone).
const deleteImage = async ({ vendorId, userId, imageId }) => {
    try {
        const image = await ImageAsset.findOne({ _id: imageId, vendorId, status: { $ne: 'D' } })
            .select('vendorId provider key storageAccount').lean();
        if (!image) return common.returnResult(true, 200, 'Image already removed.');

        await storageCredentialsService.deleteStoredAsset({ area: STORAGE_AREAS.IMAGE, asset: image, getProvider });
        await common.softDelete(ImageAsset, imageId, userId, vendorId);
        return common.returnResult(true, 200, 'Image removed.');
    } catch (err) {
        throw err;
    }
};

module.exports = {
    maxImageSizeMBOf,
    validateImage,
    uploadImage,
    deleteImage
};
