const companySettingsService = require('../services/companySettingsService');
const taxSettingsService = require('../services/taxSettingsService');
const { sendSuccess, sendError, sendResult } = require('../utils/common');
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

const respond = (res, result, meta) => {
    if (result.isSuccess) logInfo(1, 0, result.message, meta);
    else logInfo(0, 1, result.message, meta);
    return sendResult(res, result);
};

// GET /api/company-settings
const getGeneralSettings = async (req, res) => {
    try {
        const result = companySettingsService.getGeneralSettings(req.companySettingsData);
        return sendResult(res, result);
    } catch (err) {
        logException('Error while fetching company settings', err);
    }
};

// PUT /api/company-settings/general
const updateGeneralSettings = async (req, res) => {
    try {
        const result = await companySettingsService.updateGeneralSettings({ vendorId: req.vendorId, userId: req.user._id, data: req.body });
        return respond(res, result, { vendorId: req.vendorId });
    } catch (err) {
        logException('Error while saving company settings', err);
    }
};

// GET /api/company-settings/tax
const getTaxSettings = async (req, res) => {
    try {
        const result = await taxSettingsService.getTaxSettings({
            companyMasterData: req.companyMasterData, companySettingsData: req.companySettingsData
        });
        return sendResult(res, result);
    } catch (err) {
        logException('Error while fetching tax settings', err);
    }
};

// PUT /api/company-settings/tax/:countryId
const updateTaxDetails = async (req, res) => {
    try {
        const result = await taxSettingsService.updateTaxDetails({
            vendorId: req.vendorId, userId: req.user._id, countryId: req.params.countryId, data: req.body, companyMasterData: req.companyMasterData
        });
        return respond(res, result, { vendorId: req.vendorId, countryId: req.params.countryId });
    } catch (err) {
        logException('Error while saving tax details', err);
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
    getGeneralSettings,
    updateGeneralSettings,
    getTaxSettings,
    updateTaxDetails,
    uploadLogo
};
