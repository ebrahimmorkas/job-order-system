require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const Vendor = require('../models/Vendor');
const SEED_VENDOR_DOMAIN = require('./seedDomain');

// Creates the vendor for SEED_VENDOR_DOMAIN (see seeds/seedDomain.js).
//
// Safe to re-run: matched by domain and left as it is if it already exists
// (its _id, which every vendor-scoped document points at, never changes).
async function seedVendor() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    await Vendor.findOneAndUpdate(
      { domain: SEED_VENDOR_DOMAIN },
      { $setOnInsert: { domain: SEED_VENDOR_DOMAIN } },
      {
        upsert: true,
        returnDocument: 'after',
        setDefaultsOnInsert: true
      }
    );

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    process.stderr.write(`seedVendor failed: ${error.message}\n`);
    await mongoose.connection.close();
    process.exit(1);
  }
}

seedVendor();
