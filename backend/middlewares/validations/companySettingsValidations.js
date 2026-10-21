const Joi = require('joi');

// PUT /api/company-settings/logo. The image itself (req.file) is checked by
// middlewares/imageUpload.js (type, hard size cap, one file) and
// imageUploadService (the vendor's own size limit, real image content); the
// multipart body carries no text fields, so anything sent alongside is refused.
const logoUploadSchema = Joi.object({}).unknown(false);

module.exports = {
    logoUploadSchema
};
