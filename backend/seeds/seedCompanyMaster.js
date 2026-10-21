require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');

const CompanyMaster = require('../models/CompanyMaster');
const Vendor = require('../models/Vendor');

// Run after seedVendor. Creates the CompanyMaster document of the vendor below.
//
// Safe to re-run: matched by vendorId and updated in place.
const VENDOR_DOMAIN = require('./seedDomain');

const COMPANY_MASTER = {
    // Messages
    featureDisabledForVendorMessage: 'This feature is not enabled for your account. Please contact support.'
};

async function seedCompanyMaster() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const vendor = await Vendor.findOne({ domain: VENDOR_DOMAIN });
        if (!vendor) {
            throw new Error(`Vendor ${VENDOR_DOMAIN} not found. Please run seedVendor first.`);
        }

        await CompanyMaster.findOneAndUpdate(
            { vendorId: vendor._id },
            { $set: { ...COMPANY_MASTER, vendorId: vendor._id } },
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
        process.stderr.write(`seedCompanyMaster failed: ${error.message}\n`);
        await mongoose.connection.close();
        process.exit(1);
    }
}

seedCompanyMaster();
