const ImageAsset = require('../models/ImageAsset');
const { getProvider } = require('./providers/providerFactory');
const storageCredentialsService = require('./storageCredentialsService');
const { STORAGE_AREAS, IMAGE_EXTENSIONS } = require('../constants/storageConstants');
const { detectImageType } = require('../utils/imageType');
const common = require('../utils/common');
const logger = require('../utils/logger');

// Checks an uploaded image (req.file from middlewares/imageUpload.js) against
// the vendor's size limit and its real content. Success meta: { mimeType }.
const validateImage = (file, companyMasterData) => {
    try {
        if (!file) {
            return common.returnResult(false, 400, 'Please choose an image to upload.');
        }
        const maxSizeMB = companyMasterData?.maxImageUploadSizeMB ?? 2;
        if (file.size > maxSizeMB * 1024 * 1024) {
            return common.returnResult(false, 400, `The image is larger than the allowed ${maxSizeMB} MB.`);
        }
        // The browser-sent type is only a claim - the bytes decide.
        const mimeType = detectImageType(file.buffer);
        if (!mimeType) {
            return common.returnResult(false, 400, 'The file is not a valid JPG, PNG, WebP or GIF image.');
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
const uploadImage = async ({ vendorId, userId, module, file, companyMasterData, websiteMasterData }) => {
    try {
        const validation = validateImage(file, companyMasterData);
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
    uploadImage,
    deleteImage
};
