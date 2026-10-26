// The vendor domain a request was made on - vendorDetection and the live
// updates (realtimeService) both find the vendor by it.
//
// Live (stage), the browser talks to the frontend host (Vercel), which
// forwards /api and /socket.io to this server. With TRUST_PROXY set, the
// domain the visitor opened comes in X-Forwarded-Host. If a proxy in between
// drops that header, the request arrives on this server's own address
// (RENDER_EXTERNAL_HOSTNAME, set by Render itself) - only then is
// DEFAULT_VENDOR_DOMAIN used, when it is set.
const resolveDomain = (hostname) => {
    try {
        const domain = String(hostname || '').toLowerCase();
        const backendOwnHostname = (process.env.RENDER_EXTERNAL_HOSTNAME || '').trim().toLowerCase();
        const defaultVendorDomain = (process.env.DEFAULT_VENDOR_DOMAIN || '').trim().toLowerCase();

        if (defaultVendorDomain && backendOwnHostname && domain === backendOwnHostname) {
            return defaultVendorDomain;
        }
        return domain;
    } catch (err) {
        throw err;
    }
};

// For a request Express has not parsed (the live updates' handshake): the
// host name from the headers, read the way req.hostname reads it - the first
// X-Forwarded-Host when TRUST_PROXY is set, else Host - without the port.
const hostnameFromHeaders = (headers) => {
    try {
        const forwarded = process.env.TRUST_PROXY ? String(headers['x-forwarded-host'] || '').split(',')[0].trim() : '';
        return (forwarded || String(headers.host || '')).replace(/:\d+$/, '');
    } catch (err) {
        throw err;
    }
};

module.exports = { resolveDomain, hostnameFromHeaders };
