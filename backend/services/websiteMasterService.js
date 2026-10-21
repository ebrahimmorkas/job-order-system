const WebsiteMaster = require('../models/WebsiteMaster');
const logger = require('../utils/logger');

// The single platform-wide WebsiteMaster document, or null if it hasn't been
// created yet (run seeds/seedWebsiteMaster.js).
const fetchWebsiteMasterData = async () => {
    logger.logInfo(null, null, 'Fetching website master data from DB');
    const websiteMasterData = await WebsiteMaster.findOne();
    if (!websiteMasterData) {
        logger.logInfo(0, 1, 'Website master data not found');
        return null;
    }
    logger.logInfo(1, 0, 'Website master data fetched successfully');
    return websiteMasterData;
};

module.exports = {
    fetchWebsiteMasterData
};
