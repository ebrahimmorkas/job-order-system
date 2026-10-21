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
const getLimits = (websiteMasterData) => ({
    maxAttempts: websiteMasterData?.maxLoginAttempts ?? DEFAULT_MAX_LOGIN_ATTEMPTS,
    lockoutMinutes: websiteMasterData?.loginLockoutMinutes ?? DEFAULT_LOGIN_LOCKOUT_MINUTES
});

const toKey = ({ vendorId, identifier, ip }) => ({ vendorId, identifier, ip });

// The minutes left on the lock (rounded up), or 0 when not locked.
const getLockMinutesLeft = async (key) => {
    const now = new Date();
    const attempt = await LoginAttempt.findOne({ ...toKey(key), lockedUntil: { $gt: now } }).lean();
    if (!attempt) return 0;
    return Math.ceil((attempt.lockedUntil - now) / 60000);
};

// Counts one failed login and locks the combination when it reaches the
// limit. A single atomic update, so parallel wrong passwords can't slip past
// the count.
const recordFailure = async (key, limits) => {
    const now = new Date();
    const lockoutMs = limits.lockoutMinutes * 60000;

    await LoginAttempt.findOneAndUpdate(
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
};

const clearFailures = (key) => LoginAttempt.deleteOne(toKey(key));

module.exports = {
    getLimits,
    getLockMinutesLeft,
    recordFailure,
    clearFailures
};
