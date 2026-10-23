const common = require('../utils/common');
const logger = require('../utils/logger');

// A multipart request (files + data) carries its JSON in the "data" field:
// this puts that JSON in req.body, so validate() and the controller see the
// same body as a plain JSON request. Runs after multer; a JSON request passes
// through untouched.
//   router.post('/', imageUpload.multiple.array('images'), parseMultipartData, validate(schema), controller.create);
const parseMultipartData = (req, res, next) => {
    try {
        if (!req.is('multipart/form-data')) return next();
        if (typeof req.body?.data !== 'string') {
            return common.sendError(res, 400, 'Missing "data" field with the JSON of the request.');
        }
        req.body = JSON.parse(req.body.data);
        next();
    } catch (error) {
        if (error instanceof SyntaxError) return common.sendError(res, 400, 'Invalid JSON in the "data" field.');
        logger.logException('Exception in parseMultipartData middleware', error);
    }
};

module.exports = parseMultipartData;
