import { useCallback, useState } from 'react';
import Tabs from '../../../components/common/Tabs';
import { useUnsavedChanges } from '../../../components/common/UnsavedChanges';
import GeneralSettingsTab from '../components/GeneralSettingsTab';
import TaxSettingsTab from '../components/TaxSettingsTab';

/**
 * Company Settings, tab by tab. The Tax tab is shown only while the tax
 * feature is on for the vendor (with at least one country assigned).
 * Every tab stays mounted, so switching tabs never loses what was typed;
 * leaving the page with unsaved changes in any tab asks first.
 *
 * @param {Object} props
 * @param {Object|null} props.featureAccess - From the logged-in layout (null while loading)
 */
const CompanySettingsPage = ({ featureAccess }) => {
  const showTax = featureAccess?.isTaxFeatureOn === true;
  const [activeTab, setActiveTab] = useState('general');
  // Which forms have unsaved changes, by a key of each form.
  const [dirtyForms, setDirtyForms] = useState({});

  const handleDirtyChange = useCallback((key, isDirty) => {
    setDirtyForms((prev) => (!!prev[key] === isDirty ? prev : { ...prev, [key]: isDirty }));
  }, []);
  useUnsavedChanges(Object.values(dirtyForms).some(Boolean));

  const tabs = [
    { key: 'general', label: 'General' },
    ...(showTax ? [{ key: 'tax', label: 'Tax' }] : []),
  ];
  const current = tabs.some((tab) => tab.key === activeTab) ? activeTab : 'general';

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Company Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Your company's details{showTax ? ', address and tax registration' : ''}.</p>
      </div>

      <Tabs items={tabs} value={current} onChange={setActiveTab} />

      <div role="tabpanel" id="tabpanel-general" aria-labelledby="tab-general" hidden={current !== 'general'}>
        <GeneralSettingsTab onDirtyChange={handleDirtyChange} />
      </div>
      {showTax && (
        <div role="tabpanel" id="tabpanel-tax" aria-labelledby="tab-tax" hidden={current !== 'tax'}>
          <TaxSettingsTab onDirtyChange={handleDirtyChange} />
        </div>
      )}
    </div>
  );
};

export default CompanySettingsPage;
