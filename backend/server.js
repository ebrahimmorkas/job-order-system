require('dotenv').config({ quiet: true });

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const logger = require('./utils/logger.js');
const common = require('./utils/common');
const { connectRedis, closeRedis } = require('./config/redisConfig');
const { loadAllModels } = require('./models');
const { checkModelsAudited } = require('./models/plugins/auditPlugin');
// Middlewares
const { requestContext } = require('./middlewares/requestContext');
const vendorDetection = require('./middlewares/vendorDetection');
const ensureVendorDataCached = require('./middlewares/ensureVendorDataCached');
const authenticate = require('./middlewares/authenticate');
// Routes
const authRoutes = require('./routes/authRoutes');
const publicRoutes = require('./routes/publicRoutes');
const companySettingsRoutes = require('./routes/companySettingsRoutes');
const featureAccessRoutes = require('./routes/featureAccessRoutes');
const controlRoutes = require('./routes/controlRoutes');
const jobOrderRoutes = require('./routes/jobOrderRoutes');
const roleRoutes = require('./routes/roleRoutes');
const userRoutes = require('./routes/userRoutes');
const layoutRoutes = require('./routes/layoutRoutes');
const masterRoutes = require('./routes/masterRoutes');
const storageProviderConfig = require('./config/storageProviderConfig');

// Every model must carry the audit history (or be listed as exempt) - refuse
// to start otherwise.
loadAllModels();
checkModelsAudited();

const app = express();
const PORT = process.env.PORT || 5000;

// Behind a reverse proxy (nginx) every request arrives from the proxy's own
// address. TRUST_PROXY tells Express how many proxies to trust, so req.ip is
// the real visitor's address (login limits and logs depend on it). Leave it
// unset when there is no proxy, or anyone could fake their IP.
if (process.env.TRUST_PROXY) {
    const value = process.env.TRUST_PROXY;
    app.set('trust proxy', /^\d+$/.test(value) ? Number(value) : value);
}

// Must be the first middleware mounted - every downstream middleware,
// controller, and service needs to run inside its AsyncLocalStorage context
// so utils/logger.js's logException() can reach req.vendorId/req.user for
// the ErrorLog it writes, without changing any existing logException() call site.
app.use(requestContext);

// Standard security headers on every response.
app.use(helmet());

// credentials: the refresh-token cookie must be allowed on cross-origin calls.
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));

connectDB();

// Images stored on this server's disk (the 'local' storage provider). Served
// before vendor detection, so a file costs no DB query; file names are random
// and never reused, so browsers may cache them for good. In production nginx
// should serve this folder itself.
app.use(storageProviderConfig.local.baseUrl, express.static(storageProviderConfig.local.basePath, {
    maxAge: '30d', immutable: true, index: false, dotfiles: 'deny', fallthrough: false
}));

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser(process.env.COOKIE_SECRET));

// Apply middlewares to all routes
app.use(vendorDetection);

if (process.env.IS_REDIS_SERVER_ON == 1) {
    logger.logInfo(1, 0, "Redis is enabled");
    connectRedis();
}

app.use(ensureVendorDataCached);

// Public routes - the only ones reachable without logging in.
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);

// Everything mounted below this line requires a logged-in user. New routes go
// below it unless they truly must be public.
app.use('/api', authenticate);

app.use('/api/company-settings', companySettingsRoutes);
app.use('/api/feature-access', featureAccessRoutes);
app.use('/api/masters', masterRoutes);
app.use('/api/controls', controlRoutes);
app.use('/api/job-orders', jobOrderRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/users', userRoutes);
app.use('/api/layouts', layoutRoutes);

// No route matched: the same JSON shape as every other error, instead of
// Express's default HTML page.
app.use((req, res) => common.sendError(res, 404, `Route not found: ${req.method} ${req.originalUrl}`));

// Must stay after every route: turns anything thrown outside a controller's
// try/catch into an ErrorLog + the error-page 500 (or a 4xx for bad input).
app.use(require('./middlewares/errorHandler'));

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// On stop (Ctrl+C, or SIGTERM from pm2/docker/systemd): stop taking new
// requests, let the ones in progress finish, then close MongoDB and Redis
// cleanly. Forced out after 10 seconds if something hangs.
let shuttingDown = false;
const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.logInfo(1, 0, `${signal} received - shutting down`);
    setTimeout(() => process.exit(1), 10000).unref();
    server.close(async () => {
        await closeRedis();
        await mongoose.connection.close();
        process.exit(0);
    });
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
