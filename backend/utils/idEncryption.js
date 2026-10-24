const { encodeId, tryDecodeId } = require('./common');

// Raw MongoDB ids never leave the server: every id in a response, a live
// update or a login token is encoded (common.encodeId - the same id always
// gives the same string), and every encoded id a page sends back (URL,
// query, body) is decoded before validation and the controllers see it.
// A raw id sent in is refused (it fails the id checks) - a page only ever
// has encoded ones.

const RAW_ID = /^[a-f0-9]{24}$/;
// What encodeId makes of a 24-character id: 32 bytes, base64url.
const ENCODED_ID = /^[A-Za-z0-9_-]{43}$/;
// Keys holding ids: _id, id, ids, roleId, valueIds...
const ID_KEY = /^(_id|id|ids)$|Ids?$/;
// Field error names carry ids too: "masters.<masterId>", "roles.<roleId>".
const ERROR_FIELD_KEY = 'field';
// Never decoded: what a person types.
const TYPED_KEYS = new Set(['password', 'currentPassword', 'newPassword', 'identifier']);
const NOT_AN_ID = 'not-an-id';

const isObjectId = (value) => value?._bsontype === 'ObjectId';
const isPlainObject = (value) => Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null;

/** An encoded id back to the raw one; null when it isn't one. */
const decodedOrNull = (value) => {
    try {
        if (!ENCODED_ID.test(value)) return null;
        const raw = tryDecodeId(value);
        return raw && RAW_ID.test(raw) ? raw : null;
    } catch (err) {
        throw err;
    }
};

/**
 * Every id in data encoded: ObjectIds anywhere, 24-hex strings under id keys
 * (ids already turned into strings) and in field error names, and object keys
 * that are ids. Returns a copy; Dates and the rest stay as they are.
 */
const encodeIds = (data, isIdKey = false) => {
    try {
        if (data === null || data === undefined) return data;
        if (isObjectId(data)) return encodeId(data.toHexString());
        if (typeof data === 'string') return isIdKey && RAW_ID.test(data) ? encodeId(data) : data;
        if (typeof data !== 'object' || data instanceof Date || Buffer.isBuffer(data)) return data;
        if (Array.isArray(data)) return data.map((item) => encodeIds(item, isIdKey));
        if (data instanceof Map) return encodeIds(Object.fromEntries(data), isIdKey);
        // A mongoose document: its plain fields.
        if (typeof data.toObject === 'function' && !isPlainObject(data)) return encodeIds(data.toObject(), isIdKey);
        if (!isPlainObject(data)) return data;
        const out = {};
        for (const [key, value] of Object.entries(data)) {
            const outKey = RAW_ID.test(key) ? encodeId(key) : key;
            out[outKey] = key === ERROR_FIELD_KEY && typeof value === 'string'
                ? value.split('.').map((part) => (RAW_ID.test(part) ? encodeId(part) : part)).join('.')
                : encodeIds(value, ID_KEY.test(key));
        }
        return out;
    } catch (err) {
        throw err;
    }
};

/**
 * Every encoded id in what a page sent decoded (strings and object keys); a
 * raw id under an id key is made invalid, so it is refused like any bad id.
 * Typed values (passwords...) are left alone.
 */
const decodeIds = (data, isIdKey = false) => {
    try {
        if (typeof data === 'string') {
            const raw = decodedOrNull(data);
            if (raw) return raw;
            return isIdKey && RAW_ID.test(data) ? NOT_AN_ID : data;
        }
        if (Array.isArray(data)) return data.map((item) => decodeIds(item, isIdKey));
        if (data === null || typeof data !== 'object' || !isPlainObject(data)) return data;
        const out = {};
        for (const [key, value] of Object.entries(data)) {
            out[decodedOrNull(key) || key] = TYPED_KEYS.has(key) ? value : decodeIds(value, ID_KEY.test(key));
        }
        return out;
    } catch (err) {
        throw err;
    }
};

/** A URL with its encoded ids decoded - path parts and query values; raw ids made invalid. */
const decodeUrl = (url) => {
    try {
        const [path, query] = url.split(/\?(.*)/s);
        const part = (value, isIdKey) => {
            const raw = decodedOrNull(value);
            if (raw) return raw;
            return isIdKey && RAW_ID.test(value) ? NOT_AN_ID : value;
        };
        // Every path part may be an id (/users/:id/edit).
        const outPath = path.split('/').map((value) => part(value, true)).join('/');
        if (query === undefined) return outPath;
        const outQuery = query.split('&').map((pair) => {
            const at = pair.indexOf('=');
            if (at === -1) return pair;
            // Ids are plain base64url / hex: nothing to unescape.
            const value = pair.slice(at + 1);
            const decoded = part(value, ID_KEY.test(pair.slice(0, at)));
            return decoded === value ? pair : `${pair.slice(0, at)}=${decoded}`;
        }).join('&');
        return `${outPath}?${outQuery}`;
    } catch (err) {
        throw err;
    }
};

module.exports = {
    encodeIds,
    decodeIds,
    decodeUrl
};
