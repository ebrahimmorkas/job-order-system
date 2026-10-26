const logger = require('../utils/logger');

// Render's free plan stops the server after 15 minutes without a request,
// and waking it takes about half a minute - the first visitor after a quiet
// spell waits or gets an error, and the watchers started in server.js stop.
//
// This calls the server's own public /healthz every 10 minutes so it never
// counts as idle. It only runs on Render (RENDER_EXTERNAL_URL is set by Render
// itself), so local development is untouched. KEEP_ALIVE_ENABLED=0 turns it
// off, e.g. on a paid plan that never sleeps.
//
// Never throws: a failed ping is only logged, and the next one is tried.

const KEEP_ALIVE_INTERVAL_MS = 10 * 60 * 1000;
const KEEP_ALIVE_TIMEOUT_MS = 30 * 1000;

let keepAliveTimer = null;

const pingSelf = async (url) => {
    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(KEEP_ALIVE_TIMEOUT_MS) });
        if (!response.ok) {
            logger.logInfo(0, 1, 'Keep-alive ping answered with an error status', { status: response.status });
        }
    } catch (err) {
        logger.logInfo(0, 1, 'Keep-alive ping failed', { error: err.message });
    }
};

const start = () => {
    try {
        const baseUrl = (process.env.RENDER_EXTERNAL_URL || '').trim().replace(/\/+$/, '');
        if (!baseUrl || process.env.KEEP_ALIVE_ENABLED == 0 || keepAliveTimer) {
            return false;
        }

        const url = `${baseUrl}/healthz`;
        keepAliveTimer = setInterval(() => pingSelf(url), KEEP_ALIVE_INTERVAL_MS);
        // Never the reason the process stays up.
        keepAliveTimer.unref();

        logger.logInfo(1, 0, 'Keep-alive started', { url });
        return true;
    } catch (err) {
        logger.logInfo(0, 1, 'Keep-alive could not be started', { error: err.message });
        return false;
    }
};

module.exports = { start };
