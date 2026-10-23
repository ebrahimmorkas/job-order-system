const multer = require('multer');
const logger = require('../utils/logger');
const { IMAGE_MIME_TYPES, MAX_IMAGE_UPLOAD_MB, MAX_IMAGES_PER_REQUEST } = require('../constants/storageConstants');

// MAX_IMAGE_UPLOAD_MB is the hard ceiling for any image upload. The vendor's
// own (smaller) limit, CompanyMaster.maxImageUploadSizeMB, is checked in
// imageUploadService - this one stops multer from ever buffering more than
// this in memory.

const fileFilter = (req, file, cb) => {
    try {
        if (IMAGE_MIME_TYPES.includes(file.mimetype)) return cb(null, true);
        // status 400: the uploader's mistake - errorHandler answers it as a 4xx.
        cb(Object.assign(new Error('Only JPG, PNG, WebP or GIF images can be uploaded.'), { status: 400 }));
    } catch (err) {
        logger.logException('Exception in imageUpload fileFilter', err);
    }
};

// One image in memory (never written to disk here): imageUploadService sends
// req.file.buffer straight to the storage provider, and the buffer is freed
// with the request.
//
//   router.put('/logo', imageUpload.single('logo'), controller.uploadLogo);
const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_UPLOAD_MB * 1024 * 1024, files: 1, fields: 5 },
    fileFilter
});

// Several images with a JSON "data" field (e.g. a job order):
//
//   router.post('/', imageUpload.multiple.array('images'), parseMultipartData, validate(schema), controller.create);
imageUpload.multiple = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_UPLOAD_MB * 1024 * 1024, files: MAX_IMAGES_PER_REQUEST, fields: 5 },
    fileFilter
});

module.exports = imageUpload;
