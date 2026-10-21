// Every feature that can be switched on/off. Each flag exists, under the same
// name, in BOTH WebsiteMaster (platform-wide) and CompanyMaster (per vendor);
// the feature works only when it is on in both (common.checkFeatureOnOrOff).
// Add a new flag here and to both schemas.
const FEATURE_FLAGS = {
    MASTER_MODULE: 'isMasterModuleFeatureOn'
};

module.exports = {
    FEATURE_FLAGS,
    FEATURE_FLAG_VALUES: Object.values(FEATURE_FLAGS)
};
