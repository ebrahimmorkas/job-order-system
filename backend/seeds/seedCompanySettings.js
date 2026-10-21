require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');

const CompanySettings = require('../models/CompanySettings');
const Vendor = require('../models/Vendor');

// Run after seedVendor. Creates the CompanySettings document of the vendor
// for SEED_VENDOR_DOMAIN, with the company name / login tagline from
// SEED_COMPANY_NAME / SEED_LOGIN_TAGLINE in .env.
//
// Safe to re-run: an existing vendor's settings are left as they are - the
// vendor owns them and may have changed them since.
const VENDOR_DOMAIN = require('./seedDomain');

const COMPANY_SETTINGS = {
    companyName: process.env.SEED_COMPANY_NAME,
    loginTagline: process.env.SEED_LOGIN_TAGLINE || null
};

async function seedCompanySettings() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const vendor = await Vendor.findOne({ domain: VENDOR_DOMAIN });
        if (!vendor) {
            throw new Error(`Vendor ${VENDOR_DOMAIN} not found. Please run seedVendor first.`);
        }

        if (await CompanySettings.exists({ vendorId: vendor._id })) {
            process.stdout.write(`Company settings already exist for ${VENDOR_DOMAIN} - left unchanged.
`);
        } else {
            if (!COMPANY_SETTINGS.companyName) {
                throw new Error('Set SEED_COMPANY_NAME in .env (or the environment) before seeding a new vendor.');
            }
            await CompanySettings.create({ ...COMPANY_SETTINGS, vendorId: vendor._id });
            process.stdout.write(`Company settings created for ${VENDOR_DOMAIN}.
`);
        }

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        process.stderr.write(`seedCompanySettings failed: ${error.message}\n`);
        await mongoose.connection.close();
        process.exit(1);
    }
}

seedCompanySettings();
