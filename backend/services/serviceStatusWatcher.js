const WebsiteMaster = require('../models/WebsiteMaster');
const CompanyMaster = require('../models/CompanyMaster');
const CompanySettings = require('../models/CompanySettings');
const redisService = require('./redisService');
const redisKeys = require('../utils/redisKeys');
const logger = require('../utils/logger');
const { SERVICE_STATUS_POLL_MS } = require('../constants/serviceStatusConstants');

// The platform owner switches maintenance / payment straight in the database
// (no screens), so the app's cache and its open pages don't hear of it.
// Every SERVICE_STATUS_POLL_MS this compares those fields with the last look:
// a change clears the cached data (so the next request sees it) and tells
// every listener (open pages are told at once). It also tells when a closed
// shop's estimatedResumeTime has passed (the shop opened by itself).
//
//   serviceStatusWatcher.onChange(({ vendorId }) => ...)   - vendorId null = every vendor

const listeners = [];
let lastSeen = null;
let timer = null;

const keyOf = (doc, fields) => JSON.stringify(fields.map((field) => doc?.[field] ?? null));
const WEBSITE_FIELDS = ['underMaintenance', 'maintenanceMessage'];
const VENDOR_FIELDS = ['underMaintenance', 'maintenanceMessage', 'paymentNotDone', 'paymentMessage'];

const notify = async (vendorId) => {
    try {
        if (vendorId) await redisService.del(redisKeys.companyMaster(vendorId));
        else await redisService.del(redisKeys.websiteMaster());
        for (const listener of listeners) listener({ vendorId });
    } catch (err) {
        throw err;
    }
};

const look = async () => {
    try {
        const now = new Date();
        const since = lastSeen?.at || now;
        const [website, vendors, reopened] = await Promise.all([
            WebsiteMaster.findOne().select(WEBSITE_FIELDS.join(' ')).lean(),
            CompanyMaster.find().select(`vendorId ${VENDOR_FIELDS.join(' ')}`).lean(),
            // Shops whose time to open came since the last look.
            lastSeen ? CompanySettings.find({ shopClosed: true, estimatedResumeTime: { $gt: since, $lte: now } }).select('vendorId').lean() : []
        ]);
        const seen = {
            at: now,
            website: keyOf(website, WEBSITE_FIELDS),
            vendors: new Map(vendors.map((doc) => [String(doc.vendorId), keyOf(doc, VENDOR_FIELDS)]))
        };
        if (lastSeen) {
            if (seen.website !== lastSeen.website) await notify(null);
            for (const [vendorId, key] of seen.vendors) {
                if (lastSeen.vendors.get(vendorId) !== key) await notify(vendorId);
            }
            for (const { vendorId } of reopened) for (const listener of listeners) listener({ vendorId: String(vendorId) });
        }
        lastSeen = seen;
    } catch (err) {
        throw err;
    }
};

const start = () => {
    try {
        if (timer) return;
        // A background job: a failed look is logged and the next one tries again.
        const lookSafely = () => look().catch((err) => logger.logWarning('Watching the service status failed', err));
        timer = setInterval(lookSafely, SERVICE_STATUS_POLL_MS);
        timer.unref();
        lookSafely();
    } catch (err) {
        throw err;
    }
};

const onChange = (listener) => {
    try {
        listeners.push(listener);
    } catch (err) {
        throw err;
    }
};

module.exports = {
    start,
    onChange
};
