require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const Vendor = require('../models/Vendor');
const User = require('../models/User');
const { ROLES } = require('../constants/roleConstants');

// The vendor's owner account - every vendor gets exactly one login. Run after
// seedVendor.
//
// The password is NOT written in this file - it is read from
// SEED_ADMIN_PASSWORD in .env (which is never committed), so it stays out of
// the repository:
//   SEED_ADMIN_PASSWORD=<the owner's password>
// Remove that line from .env once the owner has been created.
//
// The owner can log in with the username, the email or the phone number.
//
// Safe to re-run: the owner is matched by vendor + email. An owner that
// already exists is left exactly as it is (its password included) - this
// script never resets a password.
const VENDOR_DOMAIN = require('./seedDomain');

const OWNER = {
    name: 'Vendor Owner',
    username: 'owner',
    email: 'vendor@localhost.com',
    phone_no: '9999999999'
};

async function seedUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const vendor = await Vendor.findOne({ domain: VENDOR_DOMAIN });
        if (!vendor) {
            throw new Error(`Vendor ${VENDOR_DOMAIN} not found. Please run seedVendor first.`);
        }

        const existingOwner = await User.findOne({ vendorId: vendor._id, email: OWNER.email, status: { $ne: 'D' } });
        if (existingOwner) {
            process.stdout.write(`Owner ${OWNER.email} already exists for ${VENDOR_DOMAIN} - left unchanged.\n`);
            await mongoose.connection.close();
            process.exit(0);
        }

        const password = process.env.SEED_ADMIN_PASSWORD;
        if (!password || password.length < 8) {
            throw new Error('Set SEED_ADMIN_PASSWORD (at least 8 characters) in .env before running this seed.');
        }

        const hashedPassword = await bcrypt.hash(password, Number(process.env.SALT_ROUNDS) || 10);

        await User.create({
            ...OWNER,
            vendorId: vendor._id,
            password: hashedPassword,
            authProvider: 'local',
            role: ROLES.OWNER
        });

        process.stdout.write(`Owner ${OWNER.email} created for ${VENDOR_DOMAIN}.\n`);
        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        process.stderr.write(`seedUser failed: ${error.message}\n`);
        await mongoose.connection.close();
        process.exit(1);
    }
}

seedUser();
