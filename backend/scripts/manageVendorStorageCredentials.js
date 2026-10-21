// Saves / shows ONE vendor's own storage accounts (Cloudinary / S3 / R2 -
// CompanyMaster.storageCredentials), picked by the vendor's domain. Touches
// nothing else on the vendor.
//
// set:
//   1. copy seeds/storageCredentials.example.json to
//      seeds/private/storageCredentials.json (git-ignored - never commit it)
//      and fill in only the areas / providers to set. A provider given
//      replaces that provider's saved account; anything left out is kept.
//      The same account may be given to several vendors.
//   2. CREDENTIALS_ENCRYPTION_KEY in .env must be the SAME key the server
//      runs with - the secrets are encrypted with it.
//   3. run the script, then delete seeds/private/storageCredentials.json.
//   4. point the vendor at the provider: CompanyMaster.imageService.
// view: prints which account each area uses (account ids only, never a secret).
//
// Credentials are read from the DB on every upload - no restart needed.
//
//   node scripts/manageVendorStorageCredentials.js set <domain>
//   node scripts/manageVendorStorageCredentials.js view <domain>
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Vendor = require('../models/Vendor');
const CompanyMaster = require('../models/CompanyMaster');
const storageCredentialsService = require('../services/storageCredentialsService');
const { storageCredentialsSchema } = require('../middlewares/validations/storageCredentialsValidations');
const { AREA_SERVICE_FIELDS, CREDENTIAL_PROVIDERS } = require('../constants/storageConstants');

const CREDENTIALS_FILE = path.join(__dirname, '..', 'seeds', 'private', 'storageCredentials.json');
const COMMANDS = ['set', 'view'];

// Reads, validates and encrypts the file -> $set entries such as
// { 'storageCredentials.image.cloudinary': {...encrypted} }.
function loadUpdates() {
    try {
        if (!fs.existsSync(CREDENTIALS_FILE)) {
            throw new Error(`${CREDENTIALS_FILE} not found - nothing to save.`);
        }
        // A missing key would make common.js use a random per-process key, and
        // the server could never decrypt what is saved.
        if (!/^[0-9a-fA-F]{64}$/.test(process.env.CREDENTIALS_ENCRYPTION_KEY || '')) {
            throw new Error('CREDENTIALS_ENCRYPTION_KEY in .env must be 64 hex characters (the key the server uses).');
        }
        let parsed;
        try {
            parsed = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
        } catch {
            throw new Error(`${CREDENTIALS_FILE} is not valid JSON.`);
        }
        const { error, value } = storageCredentialsSchema.validate(parsed, { abortEarly: false, errors: { wrap: { label: false } } });
        if (error) {
            throw new Error(`Invalid storage credentials:\n${error.details.map((d) => `  - ${d.path.join('.')}: ${d.message}`).join('\n')}`);
        }
        const updates = {};
        for (const [area, accounts] of Object.entries(value)) {
            for (const [provider, account] of Object.entries(accounts)) {
                updates[`storageCredentials.${area}.${provider}`] = storageCredentialsService.encryptAccount(provider, account);
            }
        }
        return updates;
    } catch (error) {
        throw error;
    }
}

// Which account each area will use - account ids and reference email only.
async function describe(vendorId) {
    try {
        const saved = await CompanyMaster.findOne({ vendorId }).select('+storageCredentials').lean();
        if (!saved) return '  no CompanyMaster for this vendor';
        const lines = [];
        for (const [area, fields] of Object.entries(AREA_SERVICE_FIELDS)) {
            const service = saved[fields.vendorService];
            if (!service) {
                lines.push(`  ${area}: not set -> WebsiteMaster.${fields.mainService} with the platform's .env account`);
                continue;
            }
            if (!CREDENTIAL_PROVIDERS.includes(service)) {
                lines.push(`  ${area}: ${service} (no account needed)`);
                continue;
            }
            const stored = saved.storageCredentials?.[area]?.[service];
            if (!storageCredentialsService.isAccountComplete(service, stored, true)) {
                lines.push(`  ${area}: ${service} -> WARNING: no complete account saved, uploads will be refused`);
                continue;
            }
            lines.push(`  ${area}: ${service} -> ${storageCredentialsService.buildStorageAccountId(service, stored)} (${stored.accountEmail})`);
        }
        return lines.join('\n');
    } catch (error) {
        throw error;
    }
}

async function run() {
    try {
        const [command, domain] = process.argv.slice(2);
        if (!COMMANDS.includes(command) || !domain) {
            throw new Error('Usage: node scripts/manageVendorStorageCredentials.js <set|view> <domain>');
        }
        // Validated before touching the DB, so a bad file changes nothing.
        const updates = command === 'set' ? loadUpdates() : null;

        await mongoose.connect(process.env.MONGODB_URI);
        const vendor = await Vendor.findOne({ domain: domain.trim().toLowerCase() }).select('_id domain').lean();
        if (!vendor) throw new Error(`Vendor ${domain} not found.`);

        if (updates) {
            const result = await CompanyMaster.updateOne({ vendorId: vendor._id }, { $set: updates }, { runValidators: true });
            if (result.matchedCount === 0) throw new Error(`No CompanyMaster for ${vendor.domain} - nothing saved.`);
            process.stdout.write(`Storage accounts saved for ${vendor.domain} - delete ${CREDENTIALS_FILE} now.\n`);
        }
        process.stdout.write(`Storage accounts for ${vendor.domain}:\n${await describe(vendor._id)}\n`);
    } catch (error) {
        process.stderr.write(`manageVendorStorageCredentials failed: ${error.message}\n`);
        process.exitCode = 1;
    } finally {
        await mongoose.connection.close();
    }
}

run();
