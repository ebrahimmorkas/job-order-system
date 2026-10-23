// Every feature that can be switched on/off. Each flag exists, under the same
// name, in BOTH WebsiteMaster (platform-wide) and CompanyMaster (per vendor);
// the feature works only when it is on in both (common.checkFeatureOnOrOff).
// Add a new flag here and to both schemas.
const FEATURE_FLAGS = {
    MASTER_MODULE: 'isMasterModuleFeatureOn',
    CONTROLS: 'isControlsFeatureOn',
    TAX: 'isTaxFeatureOn',
    IMAGE_UPLOAD: 'isImageUploadFeatureOn',
    // Role Master now, Users (more logins with roles) next.
    RBAC: 'isRBACFeatureOn'
};

// CompanyMaster-only switches that keep ONE read action of a feature
// working while the feature itself is off for the vendor (the feature's
// pages stay hidden and everything else stays blocked). Not used while
// the feature is on.
const FEATURE_READ_OVERRIDES = {
    // The job order form still gets the vendor's masters.
    MASTERS_FOR_JOB_ORDER: 'fetchMastersEvenWhenBitIsOff',
    // The job order form still gets the vendor's controls.
    CONTROLS_FOR_JOB_ORDER: 'fetchControlsEvenWhenBitIsOff'
};

module.exports = {
    FEATURE_FLAGS,
    FEATURE_READ_OVERRIDES,
    FEATURE_FLAG_VALUES: Object.values(FEATURE_FLAGS)
};
