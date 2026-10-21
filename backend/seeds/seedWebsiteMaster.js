require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');

const WebsiteMaster = require('../models/WebsiteMaster');

// WebsiteMaster is the platform-wide switchboard: a feature works for a vendor
// only when it is on here AND in that vendor's CompanyMaster (see
// checkFeatureOnOrOff in utils/common.js).
//
// Safe to re-run: there is a single WebsiteMaster document, updated in place.
const WEBSITE_MASTER = {
    // Messages
    temporaryFeatureOffMessage: 'This feature is temporarily unavailable. Please check back later.',
    // Login rate limiting
    maxLoginAttempts: 5,
    loginLockoutMinutes: 15,
    // Image storage - 'local' = this server's disk
    mainImageService: 'local',
    enforceMainImageService: false
};

async function seedWebsiteMaster() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        await WebsiteMaster.findOneAndUpdate(
            {},
            { $set: WEBSITE_MASTER },
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
        process.stderr.write(`seedWebsiteMaster failed: ${error.message}\n`);
        await mongoose.connection.close();
        process.exit(1);
    }
}

seedWebsiteMaster();
