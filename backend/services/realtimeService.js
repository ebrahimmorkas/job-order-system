const { Server } = require('socket.io');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const { verifyAccessToken } = require('../utils/token');
// Live updates carry encoded ids, like every response.
const { encodeIds } = require('../utils/idEncryption');
const logger = require('../utils/logger');
const { ROLES } = require('../constants/roleConstants');

// Live updates for the open pages over socket.io (path /socket.io). A page
// connects with its access token (auth: { token }); like every request, the
// vendor comes from the host name and the token's user must belong to it.
// Each connection joins its vendor's room, its own and - the owner - the
// owners' room, so the services can send to exactly who needs it:
//
//   realtimeService.toUsers(userIds, event, data)
//   realtimeService.toOwners(vendorId, event, data)
//   realtimeService.toVendor(vendorId, event, data)
//   realtimeService.toEveryone(event, data)
//
// Before start() (tests of the services, scripts) these do nothing.

let io = null;

const rooms = {
    vendor: (vendorId) => `vendor:${vendorId}`,
    owners: (vendorId) => `owners:${vendorId}`,
    user: (userId) => `user:${userId}`
};

// The same checks as middlewares/vendorDetection.js + authenticate.js.
const authenticateSocket = async (socket, next) => {
    try {
        const domain = String(socket.handshake.headers.host || '').replace(/:\d+$/, '').toLowerCase();
        const token = socket.handshake.auth?.token;
        let decoded = null;
        try {
            decoded = token ? verifyAccessToken(token) : null;
        } catch {
            decoded = null;
        }
        if (!decoded?.userId) return next(new Error('unauthorized'));

        const [vendor, user] = await Promise.all([
            Vendor.findOne({ domain, status: 'A' }).select('_id').lean(),
            User.findById(decoded.userId).select('role status vendorId').lean()
        ]);
        if (!vendor || !user || user.status !== 'A' || String(user.vendorId) !== String(vendor._id)) return next(new Error('unauthorized'));

        socket.data.vendorId = String(vendor._id);
        socket.data.userId = String(user._id);
        socket.data.isOwner = user.role === ROLES.OWNER;
        next();
    } catch (err) {
        logger.logWarning('Connecting a live page failed', err);
        next(new Error('unavailable'));
    }
};

const start = (server) => {
    try {
        if (io) return io;
        io = new Server(server, {
            serveClient: false,
            cors: { origin: process.env.CLIENT_URL, credentials: true }
        });
        io.use(authenticateSocket);
        io.on('connection', (socket) => {
            const { vendorId, userId, isOwner } = socket.data;
            socket.join([rooms.vendor(vendorId), rooms.user(userId), ...(isOwner ? [rooms.owners(vendorId)] : [])]);
        });
        return io;
    } catch (err) {
        throw err;
    }
};

const toUsers = (userIds, event, data) => {
    try {
        const targets = [...new Set(userIds.map(String))].map(rooms.user);
        if (io && targets.length > 0) io.to(targets).emit(event, encodeIds(data));
    } catch (err) {
        throw err;
    }
};

const toOwners = (vendorId, event, data) => {
    try {
        if (io) io.to(rooms.owners(vendorId)).emit(event, encodeIds(data));
    } catch (err) {
        throw err;
    }
};

const toVendor = (vendorId, event, data) => {
    try {
        if (io) io.to(rooms.vendor(vendorId)).emit(event, encodeIds(data));
    } catch (err) {
        throw err;
    }
};

const toEveryone = (event, data) => {
    try {
        if (io) io.emit(event, data);
    } catch (err) {
        throw err;
    }
};

// Someone switched off or deleted: their open pages stop hearing anything.
const disconnectUser = (userId) => {
    try {
        if (io) io.in(rooms.user(userId)).disconnectSockets(true);
    } catch (err) {
        throw err;
    }
};

module.exports = {
    start,
    toUsers,
    toOwners,
    toVendor,
    toEveryone,
    disconnectUser
};
