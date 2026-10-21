const os = require('os');
const logger = require('../config/loggerConfig');
const { getRequestContext } = require('../middlewares/requestContext');
const { redact } = require('./sensitiveFields');

// ErrorLog is required on first use, not at the top: it pulls in mongoose,
// and this file is loaded very early (by middlewares) - before the database
// connection is necessarily ready.
let ErrorLog = null;
function getErrorLogModel() {
    if (!ErrorLog) ErrorLog = require('../models/ErrorLog');
    return ErrorLog;
}

// Turns logException/logWarning's `data` - a bare Error, or an object holding
// the Error under any key ({ error }, { err }, { fetchErr }...) - into
// { error, additionalData }.
function normalizeErrorData(data) {
    if (data instanceof Error) {
        return { error: data, additionalData: {} };
    }
    if (data && typeof data === 'object') {
        const errorKey = data.error instanceof Error
            ? 'error'
            : Object.keys(data).find((key) => data[key] instanceof Error);
        if (errorKey) {
            const { [errorKey]: error, ...additionalData } = data;
            return { error, additionalData };
        }
    }
    return { error: null, additionalData: data || {} };
}

// Saves the ErrorLog document. Never awaited by its callers, and every failure
// is swallowed (logged to the console/file only), so a database problem can
// never turn a caught error into a crash or slow down the response.
async function persistErrorLog(message, error, additionalData, severity = 'ERROR') {
    try {
        const ctx = getRequestContext();
        const req = ctx?.req || null;
        const { vendorId: explicitVendorId, ...restAdditionalData } = additionalData || {};
        const vendorId = explicitVendorId || req?.vendorId || null;

        // ErrorLog belongs to a vendor. Without one (a background job, or a
        // request for a domain that matches no vendor) the error is only in
        // the console/file log written above.
        if (!vendorId) return;

        await getErrorLogModel().create({
            vendorId,
            message,
            severity,
            errorName: error?.name || null,
            errorMessage: error?.message || null,
            stack: error?.stack || null,
            environment: process.env.NODE_ENV || 'development',
            server: { hostname: os.hostname(), pid: process.pid },
            requestId: ctx?.requestId || null,
            request: req ? {
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userAgent: req.headers?.['user-agent'] || null,
                params: redact(req.params),
                query: redact(req.query),
                body: redact(req.body)
            } : null,
            user: req?.user ? {
                userId: req.user._id,
                role: req.user.role
            } : null,
            additionalData: Object.keys(restAdditionalData).length ? redact(restAdditionalData) : null
        });
    } catch (persistErr) {
        logger.error({
            error: { message: persistErr.message, stack: persistErr.stack, name: persistErr.name }
        }, 'Failed to persist ErrorLog document');
    }
}

function logInfo(success, failure, message, meta = {}) {
  logger.info(redact(meta), message);
}

function writeLog(level, message, data, error, additionalData) {
    if (error) {
        logger[level]({
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            },
            ...redact(additionalData)
        }, message);
    } else {
        logger[level](redact(data), message);
    }
}

// The 500 body logException() sends: the usual { success, message, data }
// shape, with data.errorReference = the requestId saved on the ErrorLog, which
// the error page shows so the record can be looked up. The real error message
// is only included in development; a stack never is.
function buildExceptionResponse(requestId, message, error) {
    const isDevelopment = (process.env.NODE_ENV || 'development') === 'development';
    return {
        success: false,
        message: 'Something went wrong. Please try again.',
        data: {
            errorReference: requestId || null,
            ...(isDevelopment ? { errorDetails: error?.message || message } : {})
        }
    };
}

// Answers the current request with a 500 unless something already answered
// it (or there is no request, e.g. a background job). Never throws.
function sendExceptionResponse(message, error) {
    try {
        const ctx = getRequestContext();
        const res = ctx?.res;
        if (!res || res.headersSent || res.writableEnded) return;
        res.status(500).json(buildExceptionResponse(ctx.requestId, message, error));
    } catch (sendErr) {
        logger.error({
            error: { message: sendErr.message, stack: sendErr.stack, name: sendErr.name }
        }, 'Failed to send the exception response');
    }
}

// The request FAILED: logs, saves an ErrorLog (severity ERROR) and answers the
// request with a 500 so the frontend shows the error page with the reference.
// A controller's catch block calls only this.
function logException(message, data = {}) {
    const { error, additionalData } = normalizeErrorData(data);
    writeLog('error', message, data, error, additionalData);

    // Deliberately not awaited - logException stays a plain synchronous call.
    persistErrorLog(message, error, additionalData, 'ERROR').catch(() => {});
    sendExceptionResponse(message, error);
}

// Something went wrong but the request CARRIES ON (an email that failed to
// send, a Redis miss with a database fallback, a background job): logs and
// saves an ErrorLog (severity WARNING) but never answers the request.
function logWarning(message, data = {}) {
    const { error, additionalData } = normalizeErrorData(data);
    writeLog('warn', message, data, error, additionalData);
    persistErrorLog(message, error, additionalData, 'WARNING').catch(() => {});
}

module.exports = {
  logInfo,
  logException,
  logWarning
};
