const companySettingsService = require('../services/companySettingsService');
const { sendSuccess, sendError } = require('../utils/common');
const { logInfo, logException } = require('../utils/logger');

// GET /api/public/branding - public: the login page needs it before login.
const getBranding = async (req, res) => {
    try {
        const result = companySettingsService.getBranding(req.companySettingsData);
        return sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (err) {
        logException('Error while fetching branding', err);
    }
};

// PUT /api/company-settings/logo - multipart, the image in the "logo" field.
const uploadLogo = async (req, res) => {
    try {
        const result = await companySettingsService.updateLogo({
            vendorId: req.vendorId,
            userId: req.user._id,
            file: req.file,
            companyMasterData: req.companyMasterData,
            websiteMasterData: req.websiteMasterData
        });

        if (!result.isSuccess) {
            logInfo(0, 1, result.message, { vendorId: req.vendorId });
            return sendError(res, result.statusCode, result.message);
        }

        logInfo(1, 0, result.message, { vendorId: req.vendorId });
        return sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (err) {
        logException('Error while uploading the company logo', err);
    }
};

module.exports = {
    getBranding,
    uploadLogo
};
