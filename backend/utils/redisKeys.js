// Every Redis key the app uses, in one place - so a key is never typed twice
// differently, and cache invalidation (models/plugins/cacheInvalidationPlugin.js)
// clears exactly the key that was cached.
const redisKeys = {
  websiteMaster: () => `website-master`,
  companyMaster: (vendorId) => `company-master:${vendorId}`,
  companySettings: (vendorId) => `company-settings:${vendorId}`,
};

module.exports = redisKeys;
