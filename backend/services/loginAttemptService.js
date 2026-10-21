const LoginAttempt = require('../models/LoginAttempt');

// Login rate limiting. Failed logins are counted per vendor + identifier + IP:
// after maxLoginAttempts failures in a row, that combination is locked for
// loginLockoutMinutes. Both limits live in WebsiteMaster, so they can be
// changed without a deploy. maxLoginAttempts = 0 turns the limit off.
//
// Unknown identifiers are counted exactly like real ones, so a lock never
// tells anyone whether an account exists.

const DEFAULT_MAX_LOGIN_ATTEMPTS = 5;
const DEFAULT_LOGIN_LOCKOUT_MINUTES = 15;

// websiteMasterData may be a Mongoose document or the plain object from Redis.
const getLimits = (websiteMasterData) => {
    try {
        return {
            maxAttempts: websiteMasterData?.maxLoginAttempts ?? DEFAULT_MAX_LOGIN_ATTEMPTS,
            lockoutMinutes: websiteMasterData?.loginLockoutMinutes ?? DEFAULT_LOGIN_LOCKOUT_MINUTES
        };
    } catch (err) {
        throw err;
    }
};

const toKey = ({ vendorId, identifier, ip }) => {
    try {
        return { vendorId, identifier, ip };
    } catch (err) {
        throw err;
    }
};

// The current record for this combination: { minutesLeft } (0 = not locked)
// and whether a record exists at all - so a successful login only spends a
// delete when there is something to clear.
const getAttempt = async (key) => {
    try {
        const now = new Date();
        const attempt = await LoginAttempt.findOne({ ...toKey(key), expiresAt: { $gt: now } })
            .select('lockedUntil').lean();
        if (!attempt) return { exists: false, minutesLeft: 0 };
        const lockedMs = attempt.lockedUntil ? attempt.lockedUntil - now : 0;
        return { exists: true, minutesLeft: lockedMs > 0 ? Math.ceil(lockedMs / 60000) : 0 };
    } catch (err) {
        throw err;
    }
};

// Counts one failed login and locks the combination when it reaches the
// limit. A single atomic update, so parallel wrong passwords can't slip past
// the count.
const recordFailure = async (key, limits) => {
    try {
        const now = new Date();
        const lockoutMs = limits.lockoutMinutes * 60000;

        // updateOne: nothing is sent back, the caller needs no document.
        await LoginAttempt.updateOne(
            toKey(key),
            [
                {
                    $set: {
                        // A count whose window has passed (or a new document) starts again at 1.
                        failedCount: {
                            $cond: [
                                { $lte: [{ $ifNull: ['$expiresAt', new Date(0)] }, now] },
                                1,
                                { $add: ['$failedCount', 1] }
                            ]
                        }
                    }
                },
                {
                    $set: {
                        lockedUntil: {
                            $cond: [{ $gte: ['$failedCount', limits.maxAttempts] }, new Date(now.getTime() + lockoutMs), null]
                        },
                        // Failures are counted within a window as long as the lockout.
                        expiresAt: new Date(now.getTime() + lockoutMs),
                        updatedAt: now,
                        createdAt: { $ifNull: ['$createdAt', now] }
                    }
                }
            ],
            { upsert: true, updatePipeline: true, timestamps: false }
        );
    } catch (err) {
        throw err;
    }
};

const clearFailures = async (key) => {
    try {
        await LoginAttempt.deleteOne(toKey(key));
    } catch (err) {
        throw err;
    }
};

module.exports = {
    getLimits,
    getAttempt,
    recordFailure,
    clearFailures
};
