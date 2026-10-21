const authService = require('../services/authService');
const { sendSuccess, sendError, encodeId } = require('../utils/common');
const { logInfo, logException } = require('../utils/logger');
const { refreshTokenCookieOptions } = require('../utils/cookieOptions');

// authService's login/refresh return the same minimal { _id, name, username,
// email, role } shape - only _id needs encoding. Returns a NEW object rather
// than mutating the input.
const formatAuthUserForResponse = (user) => {
    if (!user) return user;
    return { ...user, _id: user._id ? encodeId(user._id) : user._id };
};

const getDeviceMeta = (req) => ({
    userAgent: req.headers['user-agent'] || 'unknown',
    ip: req.ip || req.connection?.remoteAddress || 'unknown'
});

const login = async (req, res) => {
    try {
        const vendorId = req.vendorId;
        if (!vendorId) {
            // Vendor detection fails
            return sendError(res, 400, 'Invalid credentials');
        }
        const { identifier, password } = req.body;

        const loginUser = await authService.loginUser({ identifier, password }, getDeviceMeta(req), vendorId, req.websiteMasterData);

        if (!loginUser.isSuccess) {
            logInfo(0, 1, loginUser.message);
            return sendError(res, loginUser.statusCode, loginUser.message);
        }

        const { accessToken, user } = loginUser.meta;

        res.cookie('refreshToken', loginUser.meta.refreshToken, refreshTokenCookieOptions);

        logInfo(1, 0, 'User logged in successfully', { userId: user._id });
        return sendSuccess(res, loginUser.statusCode, loginUser.message, { user: formatAuthUserForResponse(user), accessToken });
    } catch (err) {
        logException('Error while logging in user', err);
    }
};

const refreshToken = async (req, res) => {
    try {
        const incomingRefreshToken = req.cookies?.refreshToken;

        const result = await authService.refreshAccessToken(incomingRefreshToken, getDeviceMeta(req));

        if (!result.isSuccess) {
            logInfo(0, 1, result.message);
            return sendError(res, result.statusCode, result.message);
        }

        const { accessToken, refreshToken: newRefreshToken, user } = result.meta;

        // newRefreshToken is null when this request didn't rotate (it lost a race against
        // another refresh with the same cookie) - the browser's cookie must then be left
        // alone, since the winning response is the one that carries the valid replacement.
        if (newRefreshToken) {
            res.cookie('refreshToken', newRefreshToken, refreshTokenCookieOptions);
        }

        logInfo(1, 0, result.message, {});
        return sendSuccess(res, result.statusCode, result.message, { accessToken, user: formatAuthUserForResponse(user) });
    } catch (err) {
        res.clearCookie('refreshToken', refreshTokenCookieOptions);
        logException('Error while refreshing access token', err);
    }
};

const logout = async (req, res) => {
    try {
        const result = await authService.logoutUser(req.cookies?.refreshToken);

        res.clearCookie('refreshToken', refreshTokenCookieOptions);

        if (!result.isSuccess) {
            logInfo(0, 1, result.message);
            return sendError(res, result.statusCode, result.message);
        }

        logInfo(1, 0, result.message, {});
        return sendSuccess(res, result.statusCode, result.message);
    } catch (err) {
        logException('Error while logging out user', err);
    }
};

const logoutAll = async (req, res) => {
    try {
        const result = await authService.logoutAllDevices(req.cookies?.refreshToken);

        res.clearCookie('refreshToken', refreshTokenCookieOptions);

        if (!result.isSuccess) {
            logInfo(0, 1, result.message);
            return sendError(res, result.statusCode, result.message);
        }

        logInfo(1, 0, result.message, {});
        return sendSuccess(res, result.statusCode, result.message);
    } catch (err) {
        logException('Error while logging out from all devices', err);
    }
};

module.exports = {
    login,
    refreshToken,
    logout,
    logoutAll
};
