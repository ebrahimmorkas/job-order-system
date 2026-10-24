const { FEATURE_FLAGS } = require('../constants/featureConstants');
const { FIXED_STEP_VALUES, FIXED_STEP_NAMES, WORK_TIME_STARTS } = require('../constants/stepConstants');

// The steps of assigned work a vendor has, from CompanyMaster.steps (set by
// the platform owner, no screens): in precedence order, at most
// numberOfStepsAllowed of them (fixed ones counted), and none while the steps
// feature is off on either side. Entries that make no sense (an unknown
// fixed step, a step of the vendor's own without a name, a step listed twice)
// are skipped, so a typo never breaks the vendor's app.

const isStepsOn = (websiteMasterData, companyMasterData) =>
    websiteMasterData?.[FEATURE_FLAGS.STEPS] === true && companyMasterData?.[FEATURE_FLAGS.STEPS] === true;

/**
 * @returns {Array<{ key: string, fixedStep: string|null, name: string }>}
 *   key: the fixed step ('start', 'inProgress'...) or 'custom:<name>' for the vendor's own
 */
const stepsOf = (websiteMasterData, companyMasterData) => {
    try {
        if (!isStepsOn(websiteMasterData, companyMasterData)) return [];
        const sorted = [...(companyMasterData.steps || [])]
            .filter((step) => Number.isFinite(step?.precedence))
            .sort((a, b) => a.precedence - b.precedence);
        const steps = [];
        const keys = new Set();
        for (const step of sorted) {
            const fixedStep = step.fixedStep || null;
            if (fixedStep && !FIXED_STEP_VALUES.includes(fixedStep)) continue;
            const name = (step.name || '').trim() || (fixedStep ? FIXED_STEP_NAMES[fixedStep] : '');
            if (!name) continue;
            const key = fixedStep || `custom:${name}`;
            if (keys.has(key)) continue;
            keys.add(key);
            steps.push({ key, fixedStep, name });
        }
        const allowed = companyMasterData.numberOfStepsAllowed;
        return Number.isInteger(allowed) ? steps.slice(0, allowed) : steps;
    } catch (err) {
        throw err;
    }
};

/** When the completion time of newly given work starts (steps off = when given). */
const workTimeStartsOnOf = (websiteMasterData, companyMasterData, companySettingsData) => {
    try {
        return isStepsOn(websiteMasterData, companyMasterData) && companySettingsData?.workTimeStartsOn === WORK_TIME_STARTS.ON_FIRST_STEP
            ? WORK_TIME_STARTS.ON_FIRST_STEP
            : WORK_TIME_STARTS.ON_ASSIGN;
    } catch (err) {
        throw err;
    }
};

module.exports = {
    isStepsOn,
    stepsOf,
    workTimeStartsOnOf
};
