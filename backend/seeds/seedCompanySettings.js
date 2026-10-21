require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');

const CompanySettings = require('../models/CompanySettings');
const Vendor = require('../models/Vendor');

// Run after seedVendor. Creates the CompanySettings document of the vendor below.
//
// Safe to re-run: matched by vendorId and updated in place.
const VENDOR_DOMAIN = require('./seedDomain');

const COMPANY_SETTINGS = {
};

async function seedCompanySettings() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const vendor = await Vendor.findOne({ domain: VENDOR_DOMAIN });
        if (!vendor) {
            throw new Error(`Vendor ${VENDOR_DOMAIN} not found. Please run seedVendor first.`);
        }

        await CompanySettings.findOneAndUpdate(
            { vendorId: vendor._id },
            { $set: { ...COMPANY_SETTINGS, vendorId: vendor._id } },
            {
                upsert: true,
                returnDocument: 'after',
                setDefaultsOnInsert: true,
                runValidators: true
            }
        );

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        process.stderr.write(`seedCompanySettings failed: ${error.message}\n`);
        await mongoose.connection.close();
        process.exit(1);
    }
}

seedCompanySettings();
