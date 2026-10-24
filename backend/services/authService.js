const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken, hashToken } = require('../utils/token');
const common = require('../utils/common');
const loginAttemptService = require('./loginAttemptService');
const { ROLES } = require('../constants/roleConstants');
const { isRbacOn } = require('./accessService');

const INACTIVE_ACCOUNT_MESSAGE = 'Your account has been deactivated. Please contact support.';
// Users added in the Users module log in only while RBAC is on (WebsiteMaster
// AND CompanyMaster); the owner always can.
const USER_LOGIN_OFF_MESSAGE = 'Logins for users are switched off. Please contact the owner.';
const canLogIn = (user, websiteMasterData, companyMasterData) =>
    user.role === ROLES.OWNER || (user.role === ROLES.USER && isRbacOn(websiteMasterData, companyMasterData));
const lockedMessage = (minutes) =>
    `Too many failed login attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;

// Only what login and refresh need from a user - never the whole document.
const AUTH_USER_FIELDS = '_id vendorId name username email role status authProvider password';

const toAuthUser = (user) => {
    try {
        return { _id: user._id, name: user.name, username: user.username, email: user.email, role: user.role };
    } catch (err) {
        throw err;
    }
};

// A real bcrypt hash of a random value, made once on first use. Compared
// against when the user doesn't exist, so a wrong username takes as long as
// a wrong password - otherwise the response time would tell an attacker which
// usernames exist. Same cost factor as real passwords.
let dummyPasswordHash = null;
const getDummyPasswordHash = async () => {
    try {
        dummyPasswordHash ??= await bcrypt.hash(crypto.randomUUID(), Number(process.env.SALT_ROUNDS) || 10);
        return dummyPasswordHash;
    } catch (err) {
        throw err;
    }
};

// The refresh token's expiry, read from the token we just signed ourselves -
// decode only, no second signature check.
const refreshTokenExpiry = (refreshToken) => {
    try {
        return new Date(jwt.decode(refreshToken).exp * 1000);
    } catch (err) {
        throw err;
    }
};

const loginUser = async ({ identifier, password }, deviceMeta, vendorId, websiteMasterData, companyMasterData) => {
    try {
        if (!vendorId) {
            // Vendor detection fails
            return common.returnResult(false, 401, 'Invalid credentials');
        }
        // username and email are stored lowercase; a phone number is unaffected.
        const normalizedIdentifier = String(identifier).trim().toLowerCase();

        const limits = loginAttemptService.getLimits(websiteMasterData);
        const limitOn = limits.maxAttempts > 0;
        const attemptKey = { vendorId, identifier: normalizedIdentifier, ip: deviceMeta.ip };
        const attempt = limitOn ? await loginAttemptService.getAttempt(attemptKey) : { exists: false, minutesLeft: 0 };
        // Locked: refused before any user lookup or password hashing.
        if (attempt.minutesLeft > 0) {
            return common.returnResult(false, 429, lockedMessage(attempt.minutesLeft));
        }

        // One indexed read: each $or branch uses its own { vendorId, ... } unique index.
        const user = await User.findOne({
            vendorId,
            $or: [{ username: normalizedIdentifier }, { email: normalizedIdentifier }, { phone_no: normalizedIdentifier }],
            status: { $ne: 'D' }
        }).select(AUTH_USER_FIELDS).lean();

        const canUsePassword = !!user && user.authProvider === 'local' && !!user.password;
        const isPasswordValid = await bcrypt.compare(password, canUsePassword ? user.password : await getDummyPasswordHash());
        if (!canUsePassword || !isPasswordValid) {
            if (limitOn) await loginAttemptService.recordFailure(attemptKey, limits);
            return common.returnResult(false, 401, 'Invalid credentials');
        }

        // The password was right, so the count starts again - only if there is one.
        if (attempt.exists) await loginAttemptService.clearFailures(attemptKey);

        // Checked only after the password, so it never reveals which accounts exist.
        if (user.status === 'I') {
            return common.returnResult(false, 403, INACTIVE_ACCOUNT_MESSAGE);
        }
        if (!canLogIn(user, websiteMasterData, companyMasterData)) {
            return common.returnResult(false, 403, USER_LOGIN_OFF_MESSAGE);
        }

        const accessToken = generateAccessToken({ userId: user._id, role: user.role, vendorId: user.vendorId });
        const refreshToken = generateRefreshToken({ userId: user._id });

        await RefreshToken.create({
            userId: user._id,
            tokenHash: hashToken(refreshToken),
            userAgent: deviceMeta.userAgent,
            ip: deviceMeta.ip,
            expiresAt: refreshTokenExpiry(refreshToken)
        });

        return common.returnResult(true, 200, 'Login successful', { accessToken, refreshToken, user: toAuthUser(user) });
    } catch (err) {
        throw err;
    }
};

// Refresh tokens rotate (every successful refresh issues a new one), which
// creates two ways for a browser to end up holding a token the server has
// already rotated away from. Both are handled in refreshAccessToken, and both
// rely on the rotation itself being ATOMIC (a compare-and-swap):
//
// 1. Concurrent refreshes with the same cookie (two tabs, a StrictMode double
//    effect, rapid reloads). Only the request that wins the swap rotates and
//    sets a cookie; the others get a fresh access token but NO new refresh
//    token. Otherwise every request would mint its own token, the DB would
//    keep whichever was saved last while the browser kept whichever response
//    arrived last - and nothing forces those to be the same one.
//    REFRESH_CONCURRENT_WINDOW_MS is how long after a rotation a request
//    presenting the previous token is still treated as one of those racers.
//
// 2. A rotation whose response never reaches the browser (a page reload or
//    tab close aborts the fetch, a network drop) - the server moved on, but
//    the browser still holds the old token. The previous token therefore
//    stays usable for REFRESH_LOST_RESPONSE_GRACE_MS, and presenting it after
//    the concurrent window re-rotates so the browser is handed a working
//    cookie. Cost: the token rotated away from stays valid for this long (or
//    until the next rotation replaces it) instead of dying immediately - keep
//    it short. It must comfortably exceed the access token lifetime (15m): a
//    browser that got only an access token during the concurrent window still
//    holds the old cookie, and needs it once that access token expires.
const REFRESH_CONCURRENT_WINDOW_MS = 5 * 1000;
const REFRESH_LOST_RESPONSE_GRACE_MS = 30 * 60 * 1000;

/**
 * Refresh token rotation:
 * - Verify JWT signature/expiry of the incoming refresh token.
 * - Find the session by the token's hash - either as its current token, or as the token it
 *   most recently rotated away from (still inside REFRESH_LOST_RESPONSE_GRACE_MS).
 * - Rotate with one atomic updateOne guarded on the state we just read, so of any
 *   number of concurrent refreshes exactly one rotates. Losers - and anyone presenting the
 *   previous token within REFRESH_CONCURRENT_WINDOW_MS of a rotation, whose new cookie is
 *   already on its way - get an access token only (`refreshToken: null`): the cookie the
 *   browser already has, or is about to receive, stays the one the DB knows.
 * - Not matched at all (unknown token, or previous token past its grace) -> expected
 *   failure, force re-login.
 */
const refreshAccessToken = async (incomingRefreshToken, deviceMeta, websiteMasterData, companyMasterData) => {
    try {
        if (!incomingRefreshToken) {
            return common.returnResult(false, 401, 'Session expired');
        }

        let decoded;
        try {
            decoded = verifyRefreshToken(incomingRefreshToken);
        } catch (verifyErr) {
            return common.returnResult(false, 401, 'Session expired');
        }

        const incomingHash = hashToken(incomingRefreshToken);

        // One read finds the session whether the token is its current one or
        // the one it just rotated away from (still inside the grace period).
        const session = await RefreshToken.findOne({
            userId: decoded.userId,
            isValid: true,
            $or: [
                { tokenHash: incomingHash },
                { previousTokenHash: incomingHash, previousTokenExpiresAt: { $gt: new Date() } }
            ]
        }).select('tokenHash rotatedAt expiresAt').lean();
        const isCurrentToken = !!session && session.tokenHash === incomingHash;

        if (!session) {
            return common.returnResult(false, 401, 'Session not found. Please login again');
        }

        if (session.expiresAt < new Date()) {
            await RefreshToken.deleteOne({ _id: session._id });
            return common.returnResult(false, 401, 'Session expired. Please login again');
        }

        const user = await User.findById(decoded.userId).select('_id vendorId name username email role status').lean();
        if (!user || user.status === 'D') {
            await RefreshToken.deleteOne({ _id: session._id });
            return common.returnResult(false, 401, 'User not found or inactive');
        }
        // A deactivated account loses its session at the next refresh, not 30 days later.
        if (user.status === 'I') {
            await RefreshToken.deleteOne({ _id: session._id });
            return common.returnResult(false, 403, INACTIVE_ACCOUNT_MESSAGE);
        }
        if (!canLogIn(user, websiteMasterData, companyMasterData)) {
            await RefreshToken.deleteOne({ _id: session._id });
            return common.returnResult(false, 403, USER_LOGIN_OFF_MESSAGE);
        }

        // A request presenting the PREVIOUS token right after a rotation is racing that
        // rotation's own response: don't rotate again, or its cookie and ours would fight.
        const isRacingRotation = !isCurrentToken
            && session.rotatedAt
            && (Date.now() - session.rotatedAt.getTime()) < REFRESH_CONCURRENT_WINDOW_MS;

        let newRefreshToken = null;

        if (!isRacingRotation) {
            const candidateToken = generateRefreshToken({ userId: user._id });

            // Guard = exactly the state we read above. If anything rotated in between, this
            // matches nothing and we lose the race.
            const guard = isCurrentToken
                ? { _id: session._id, tokenHash: incomingHash, isValid: true }
                : { _id: session._id, tokenHash: session.tokenHash, previousTokenHash: incomingHash, isValid: true };

            const now = new Date();
            const rotated = await RefreshToken.updateOne(guard, {
                $set: {
                    tokenHash: hashToken(candidateToken),
                    // Rotating away from the current token -> it becomes the previous one.
                    // Re-rotating because the browser never adopted the last new token -> keep
                    // the token it DOES hold as the previous one; the last new token was lost.
                    previousTokenHash: isCurrentToken ? session.tokenHash : incomingHash,
                    previousTokenExpiresAt: new Date(now.getTime() + REFRESH_LOST_RESPONSE_GRACE_MS),
                    rotatedAt: now,
                    expiresAt: refreshTokenExpiry(candidateToken),
                    lastUsedAt: now,
                    userAgent: deviceMeta.userAgent,
                    ip: deviceMeta.ip
                }
            });

            if (rotated.modifiedCount === 1) {
                newRefreshToken = candidateToken;
            } else {
                // Lost the race (someone else rotated first) - or the session was just logged
                // out. Only the former may proceed.
                const stillThere = await RefreshToken.exists({ _id: session._id, isValid: true });
                if (!stillThere) {
                    return common.returnResult(false, 401, 'Session not found. Please login again');
                }
            }
        }

        const newAccessToken = generateAccessToken({
            userId: user._id,
            role: user.role,
            vendorId: user.vendorId
        });

        return common.returnResult(true, 200, 'Session renewed successfully', {
            accessToken: newAccessToken,
            // null when this request did not rotate - the controller must then leave the
            // browser's cookie alone.
            refreshToken: newRefreshToken,
            user: toAuthUser(user)
        });
    } catch (err) {
        // Rotation is a single atomic update, so a failure here can never leave the session
        // half-rotated - no need to invalidate it (a transient DB error must not log the user out).
        throw err;
    }
};

const logoutUser = async (incomingRefreshToken) => {
    try {
        if (!incomingRefreshToken) {
            return common.returnResult(false, 400, 'No active session found');
        }

        const incomingHash = hashToken(incomingRefreshToken);
        await RefreshToken.deleteOne({ tokenHash: incomingHash });

        return common.returnResult(true, 200, `User Logged out successfully`);
    } catch (err) {
        throw err;
    }
};

const logoutAllDevices = async (incomingRefreshToken) => {
    try {
        if (!incomingRefreshToken) {
            return common.returnResult(false, 400, 'No active session found');
        }

        let decoded;
        try {
            decoded = verifyRefreshToken(incomingRefreshToken);
        } catch (verifyErr) {
            return common.returnResult(false, 401, 'Invalid or expired refresh token');
        }

        await RefreshToken.deleteMany({ userId: decoded.userId });

        return common.returnResult(true, 200, `Logged out from all the devices`);
    } catch (err) {
        throw err;
    }
};

module.exports = {
    loginUser,
    refreshAccessToken,
    logoutUser,
    logoutAllDevices
};
