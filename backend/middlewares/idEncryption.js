const logger = require('../utils/logger');
const { encodeIds, decodeIds, decodeUrl } = require('../utils/idEncryption');

// Pages only ever see encoded ids (see utils/idEncryption.js): ids in the URL,
// the query and the body are decoded here, before any route, and every JSON
// response has its ids encoded on the way out. Mounted after express.json().
const idEncryption = (req, res, next) => {
    try {
        req.url = decodeUrl(req.url);
        if (req.body && typeof req.body === 'object') req.body = decodeIds(req.body);
        const json = res.json.bind(res);
        res.json = (body) => json(encodeIds(body));
        next();
    } catch (error) {
        logger.logException('Exception in idEncryption middleware', error);
    }
};

module.exports = idEncryption;
