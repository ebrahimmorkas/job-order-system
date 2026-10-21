// Decides which field names hold secrets, so their values never reach the
// logs (utils/logger.js) or the change history (models/plugins/auditPlugin.js).
//
// Matched on the whole field name (case and _ / - ignored), never on a part
// of it: 'pin' hides `pin` but not `shipping`, and 'card' is not in the list
// at all, so `discard` or `cardTitle` stay readable.

// The whole name is one of these.
const SENSITIVE_NAMES = new Set([
    'password', 'pass', 'pwd', 'pin', 'otp', 'cvv', 'cvc', 'secret',
    'token', 'authorization', 'cookie', 'apikey', 'cardnumber', 'accountnumber'
]);

// The name ends with one of these, e.g. newPassword, refreshToken, clientSecret, smtpApiKey.
const SENSITIVE_SUFFIXES = ['password', 'token', 'secret', 'apikey', 'otp'];

const normalize = (name) => String(name).toLowerCase().replace(/[_-]/g, '');

const isSensitiveField = (name) => {
    const key = normalize(name);
    return SENSITIVE_NAMES.has(key) || SENSITIVE_SUFFIXES.some((suffix) => key.endsWith(suffix));
};

const REDACTED = '[REDACTED]';

const isPlainObject = (value) => !!value && Object.getPrototypeOf(value) === Object.prototype;

// Copy of value with every sensitive field's value replaced, at any depth.
// Only plain objects and arrays are looked into - ObjectIds, Dates, Errors
// and the like are kept as they are.
const redact = (value) => {
    if (Array.isArray(value)) return value.map(redact);
    if (isPlainObject(value)) {
        const clone = {};
        for (const [key, val] of Object.entries(value)) {
            clone[key] = isSensitiveField(key) ? REDACTED : redact(val);
        }
        return clone;
    }
    return value;
};

module.exports = {
    isSensitiveField,
    redact,
    REDACTED
};
