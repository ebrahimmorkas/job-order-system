const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const generateAccessToken = (payload) => {
    return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '15m'
    });
};

// jti makes every issuance unique even when minted for the same user within
// the same second (iat has only second-granularity) - without it, two
// tokens signed in the same second are byte-identical, which silently
// defeats rotation (the "new" token after a refresh can equal the token
// just rotated away from) and can hash-collide with an unrelated session.
const generateRefreshToken = (payload) => {
    return jwt.sign({ ...payload, jti: crypto.randomUUID() }, process.env.REFRESH_TOKEN_SECRET, {
        expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '30d'
    });
};

const verifyAccessToken = (token) => {
    return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
};

const verifyRefreshToken = (token) => {
    return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
};

// Refresh tokens are never stored raw in the DB - only their hash, so a DB leak
// alone can't be used to forge/replay sessions.
const hashToken = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    hashToken
};
