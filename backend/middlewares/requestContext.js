const { AsyncLocalStorage } = require('async_hooks');
const crypto = require('crypto');

// Makes the current request (req, res and a unique requestId) reachable from
// anywhere in the code that handles it - controllers, services, Mongoose
// hooks - without passing req down through every function. Used by
// utils/logger.js (ErrorLog, the 500 response) and models/plugins/auditPlugin.js
// (who made a change). Must be the very first middleware in server.js, so
// everything after it runs inside als.run().
const als = new AsyncLocalStorage();

const requestContext = (req, res, next) => {
    const requestId = crypto.randomUUID();
    // Lets the frontend, the logs, ErrorLog and AuditLog all be matched up.
    res.setHeader('X-Request-Id', requestId);
    als.run({ req, res, requestId }, () => next());
};

const getRequestContext = () => als.getStore() || null;

module.exports = { requestContext, getRequestContext };
