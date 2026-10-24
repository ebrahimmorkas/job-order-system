const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { encodeId, tryDecodeId } = require('./common');

// A token's payload can be read by anyone holding it, so its ids are encoded
// (common.encodeId) and decoded again once the token is verified. A token
// made before ids were encoded still carries raw ones - kept as they are.
const ID_FIELDS = ['userId', 'vendorId'];
const RAW_ID = /^[a-f0-9]{24}$/;
const withIds = (payload, change) => {
    const out = { ...payload };
    for (const field of ID_FIELDS) if (out[field]) out[field] = change(String(out[field]));
    return out;
};
const encodeIds = (payload) => withIds(payload, encodeId);
const decodeIds = (payload) => withIds(payload, (value) => (RAW_ID.test(value) ? value : tryDecodeId(value)));

const generateAccessToken = (payload) => {
    return jwt.sign(encodeIds(payload), process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '15m'
    });
};

// jti makes every issuance unique even when minted for the same user within
// the same second (iat has only second-granularity) - without it, two
// tokens signed in the same second are byte-identical, which silently
// defeats rotation (the "new" token after a refresh can equal the token
// just rotated away from) and can hash-collide with an unrelated session.
const generateRefreshToken = (payload) => {
    return jwt.sign({ ...encodeIds(payload), jti: crypto.randomUUID() }, process.env.REFRESH_TOKEN_SECRET, {
        expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '30d'
    });
};

const verifyAccessToken = (token) => {
    return decodeIds(jwt.verify(token, process.env.ACCESS_TOKEN_SECRET));
};

const verifyRefreshToken = (token) => {
    return decodeIds(jwt.verify(token, process.env.REFRESH_TOKEN_SECRET));
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
