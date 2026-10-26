import { useCallback, useEffect, useState } from 'react';
import Tabs from '../../../components/common/Tabs';
import Alert from '../../../components/common/Alert';
import Spinner from '../../../components/common/Spinner';
import { NotFoundPage } from '../../../components/errors';
import { useUnsavedChanges } from '../../../components/common/UnsavedChanges';
import { useRouter } from '../../../router';
import GeneralSettingsTab from '../components/GeneralSettingsTab';
import JobOrderSettingsCard from '../components/JobOrderSettingsCard';
import ShopSettingsCard from '../components/ShopSettingsCard';
import TaxSettingsTab from '../components/TaxSettingsTab';
import { useAccess } from '../../access/hooks/useAccess';
import * as companySettingsApi from '../api/companySettingsApi';

const TAB_KEYS = ['general', 'job-orders', 'shop', 'tax'];

/**
 * Company Settings, tab by tab: General (name, tagline, logo), Job Orders,
 * Shop (the owner only - a user closing it would lock themselves out) and
 * Tax (only while the tax feature is on, with at least one country).
 * Every tab stays mounted, so switching tabs never loses what was typed;
 * leaving the page with unsaved changes in any tab asks first. Without the
 * Edit permission everything is shown read only. The tab is in the address
 * (/company-settings, /company-settings/job-orders...), so a refresh stays on it.
 *
 * @param {Object} props
 * @param {Object|null} props.featureAccess - From the logged-in layout (null while loading)
 * @param {string} props.basePath - '/company-settings'
 * @param {string[]} props.segments - The address after it: the tab
 */
const CompanySettingsPage = ({ featureAccess, basePath, segments }) => {
  const showTax = featureAccess?.isTaxFeatureOn === true;
  const { access, can } = useAccess();
  const canEdit = can('companySettings', 'edit');
  const { navigate } = useRouter();
  // Which forms have unsaved changes, by a key of each form.
  const [dirtyForms, setDirtyForms] = useState({});

  const handleDirtyChange = useCallback((key, isDirty) => {
    setDirtyForms((prev) => (!!prev[key] === isDirty ? prev : { ...prev, [key]: isDirty }));
  }, []);
  useUnsavedChanges(Object.values(dirtyForms).some(Boolean));

  // General and Job Orders come in one answer.
  const [settings, setSettings] = useState(null);
  const [loadError, setLoadError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    companySettingsApi
      .getGeneralSettings({ signal: controller.signal })
      .then((result) => setSettings(result.settings))
      .catch((err) => err?.name !== 'AbortError' && setLoadError(err.message));
    return () => controller.abort();
  }, []);

  const tabs = [
    { key: 'general', label: 'General' },
    { key: 'job-orders', label: 'Job Orders' },
    ...(access.isOwner ? [{ key: 'shop', label: 'Shop' }] : []),
    ...(showTax ? [{ key: 'tax', label: 'Tax' }] : []),
  ];
  const [tabKey = 'general', ...rest] = segments;
  // A tab that isn't shown (e.g. Tax with the feature off, Shop for a user) opens General.
  const current = tabs.some((tab) => tab.key === tabKey) ? tabKey : 'general';
  // Switching tabs keeps what was typed, so it replaces the address.
  const openTab = (key) => navigate(key === 'general' ? basePath : `${basePath}/${key}`, { replace: true });

  if (rest.length > 0 || !TAB_KEYS.includes(tabKey) || (tabKey === 'general' && segments.length > 0)) {
    return <NotFoundPage embedded onGoHome={() => navigate('/')} />;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Company Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Your company's details, how job orders work{access.isOwner ? ', opening and closing the shop' : ''}{showTax ? ' and tax registration' : ''}.</p>
      </div>

      {!canEdit && <Alert variant="info">You can only view these settings.</Alert>}

      <Tabs items={tabs} value={current} onChange={openTab} />

      {/* A disabled fieldset turns off every field and button inside it. */}
      <fieldset disabled={!canEdit} className="m-0 min-w-0 border-0 p-0">

      <div role="tabpanel" id="tabpanel-general" aria-labelledby="tab-general" hidden={current !== 'general'}>
        {loadError && <Alert variant="error">{loadError}</Alert>}
        {!settings && !loadError && <div className="py-16 flex justify-center"><Spinner size="lg" /></div>}
        {settings && <GeneralSettingsTab initial={settings} onDirtyChange={handleDirtyChange} />}
      </div>
      <div role="tabpanel" id="tabpanel-job-orders" aria-labelledby="tab-job-orders" hidden={current !== 'job-orders'}>
        {loadError && <Alert variant="error">{loadError}</Alert>}
        {!settings && !loadError && <div className="py-16 flex justify-center"><Spinner size="lg" /></div>}
        {settings && (
          <JobOrderSettingsCard
            initial={settings.jobOrder}
            onDirtyChange={handleDirtyChange}
            showWorkTime={featureAccess?.isStepFeatureOn === true}
            showPrintWork={featureAccess?.isLayoutMasterFeatureOn === true && featureAccess?.isRBACFeatureOn === true}
            showPerRate={featureAccess?.isPerRatePricingFeatureOn === true}
          />
        )}
      </div>
      {access.isOwner && (
        <div role="tabpanel" id="tabpanel-shop" aria-labelledby="tab-shop" hidden={current !== 'shop'}>
          <ShopSettingsCard onDirtyChange={handleDirtyChange} />
        </div>
      )}
      {showTax && (
        <div role="tabpanel" id="tabpanel-tax" aria-labelledby="tab-tax" hidden={current !== 'tax'}>
          <TaxSettingsTab onDirtyChange={handleDirtyChange} />
        </div>
      )}
      </fieldset>
    </div>
  );
};

export default CompanySettingsPage;
