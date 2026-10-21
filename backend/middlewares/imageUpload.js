const multer = require('multer');
const logger = require('../utils/logger');
const { IMAGE_MIME_TYPES } = require('../constants/storageConstants');

// Hard ceiling for any image upload, in MB. The vendor's own (smaller) limit,
// CompanyMaster.maxImageUploadSizeMB, is checked in imageUploadService - this
// one stops multer from ever buffering more than this in memory.
const MAX_IMAGE_UPLOAD_MB = 20;

// One image in memory (never written to disk here): imageUploadService sends
// req.file.buffer straight to the storage provider, and the buffer is freed
// with the request.
//
//   router.put('/logo', imageUpload.single('logo'), controller.uploadLogo);
const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_UPLOAD_MB * 1024 * 1024, files: 1, fields: 5 },
    fileFilter: (req, file, cb) => {
        try {
            if (IMAGE_MIME_TYPES.includes(file.mimetype)) return cb(null, true);
            // status 400: the uploader's mistake - errorHandler answers it as a 4xx.
            cb(Object.assign(new Error('Only JPG, PNG, WebP or GIF images can be uploaded.'), { status: 400 }));
        } catch (err) {
            logger.logException('Exception in imageUpload fileFilter', err);
        }
    }
});

module.exports = imageUpload;
