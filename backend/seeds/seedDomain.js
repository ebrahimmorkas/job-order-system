// The vendor domain every seed works on: the first command-line argument,
// else SEED_VENDOR_DOMAIN from .env, else 'localhost'.
//
//   node seeds/seedVendor.js localhost1
//   SEED_VENDOR_DOMAIN=localhost1 npm run seed
//
// Exactly the hostname, as vendorDetection compares it: no "https://", no
// port, no trailing slash.
const SEED_VENDOR_DOMAIN = (process.argv[2] || process.env.SEED_VENDOR_DOMAIN || 'localhost')
    .trim()
    .toLowerCase();

module.exports = SEED_VENDOR_DOMAIN;
