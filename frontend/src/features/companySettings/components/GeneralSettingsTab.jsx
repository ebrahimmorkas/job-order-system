import { useEffect, useRef, useState } from 'react';
import InputField from '../../../components/common/InputField';
import Button from '../../../components/common/Buttons';
import Card from '../../../components/common/Card';
import Alert from '../../../components/common/Alert';
import Spinner from '../../../components/common/Spinner';
import { useToast } from '../../../components/common/Toast';
import { useBranding } from '../../branding/hooks/useBranding';
import JobOrderSettingsCard from './JobOrderSettingsCard';
import ShopSettingsCard from './ShopSettingsCard';
import { useAccess } from '../../access/hooks/useAccess';
import * as companySettingsApi from '../api/companySettingsApi';

const COMPANY_NAME_MAX_LENGTH = 100;
const TAGLINE_MAX_LENGTH = 150;
// Same types as the backend (constants/storageConstants.js IMAGE_MIME_TYPES).
const LOGO_TYPES = 'image/jpeg,image/png,image/webp,image/gif';

/**
 * Company Settings > General: the company name and login tagline (saved
 * together), the logo (uploaded as soon as it is picked) and the job order
 * settings. The sidebar, login page and browser tab show the change at once.
 *
 * @param {Object} props
 * @param {(key: string, isDirty: boolean) => void} props.onDirtyChange
 * @param {boolean} [props.showWorkTime] - Ask when the work time starts (steps on)
 * @param {boolean} [props.showPrintWork] - Ask what printed work shows (layouts and RBAC on)
 */
const GeneralSettingsTab = ({ onDirtyChange, showWorkTime = false, showPrintWork = false }) => {
  const toast = useToast();
  const { updateBranding } = useBranding();
  // Closing the shop: the owner only (a user would lock themselves out).
  const isOwner = useAccess().access.isOwner;
  const fileInputRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saved, setSaved] = useState({ companyName: '', loginTagline: '' });
  const [fields, setFields] = useState(saved);
  const [logoUrl, setLogoUrl] = useState(null);
  const [jobOrderSettings, setJobOrderSettings] = useState(null);
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [logoError, setLogoError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    companySettingsApi
      .getGeneralSettings({ signal: controller.signal })
      .then(({ settings }) => {
        const loaded = { companyName: settings.companyName || '', loginTagline: settings.loginTagline || '' };
        setSaved(loaded);
        setFields(loaded);
        setLogoUrl(settings.logoUrl);
        setJobOrderSettings(settings.jobOrder);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setLoadError(err.message);
        setIsLoading(false);
      });
    return () => controller.abort();
  }, []);

  const isDirty = fields.companyName !== saved.companyName || fields.loginTagline !== saved.loginTagline;
  useEffect(() => { onDirtyChange('general', isDirty); }, [isDirty, onDirtyChange]);

  const setField = (field, value) => {
    setFields((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    const companyName = fields.companyName.trim();
    if (companyName.length < 2) {
      setErrors({ companyName: companyName ? 'At least 2 characters' : 'Enter the company name' });
      return;
    }
    setIsSaving(true);
    try {
      const { settings } = await companySettingsApi.updateGeneralSettings({ companyName, loginTagline: fields.loginTagline.trim() || null });
      const next = { companyName: settings.companyName, loginTagline: settings.loginTagline || '' };
      setSaved(next);
      setFields(next);
      updateBranding({ companyName: settings.companyName, loginTagline: settings.loginTagline });
      toast.success('Company details saved.');
    } catch (err) {
      const fieldErrors = {};
      for (const { field, message } of err.errors || []) fieldErrors[field] = message;
      setErrors(Object.keys(fieldErrors).length > 0 ? fieldErrors : { form: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoPicked = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLogoError('');
    setIsUploading(true);
    try {
      const { logoUrl: url } = await companySettingsApi.uploadLogo(file);
      setLogoUrl(url);
      updateBranding({ logoUrl: url });
      toast.success('Logo updated.');
    } catch (err) {
      setLogoError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) return <div className="py-16 flex justify-center"><Spinner size="lg" /></div>;
  if (loadError) return <Alert variant="error">{loadError}</Alert>;

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} noValidate>
        <Card variant="outlined" title="Company details" subtitle="Shown on the login page, in the menu and as the browser tab title.">
          <div className="space-y-5">
            {errors.form && <Alert variant="error">{errors.form}</Alert>}
            <InputField
              label="Company name"
              name="companyName"
              value={fields.companyName}
              onChange={(e) => setField('companyName', e.target.value)}
              error={errors.companyName}
              maxLength={COMPANY_NAME_MAX_LENGTH}
              required
              disabled={isSaving}
            />
            <InputField
              label="Login tagline"
              name="loginTagline"
              placeholder="A short line under the company name on the login page (optional)"
              value={fields.loginTagline}
              onChange={(e) => setField('loginTagline', e.target.value)}
              error={errors.loginTagline}
              maxLength={TAGLINE_MAX_LENGTH}
              disabled={isSaving}
            />
            <div className="flex justify-end">
              <Button type="submit" loading={isSaving} loadingText="Saving..." disabled={!isDirty}>Save changes</Button>
            </div>
          </div>
        </Card>
      </form>

      <Card variant="outlined" title="Logo" subtitle="Shown on the login page, in the menu and as the browser tab icon.">
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-20 h-20 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
            {logoUrl
              ? <img src={logoUrl} alt="Company logo" className="max-w-full max-h-full object-contain" />
              : <span className="text-xs text-gray-400">No logo</span>}
          </div>
          <div className="space-y-1">
            <input ref={fileInputRef} type="file" accept={LOGO_TYPES} className="hidden" onChange={handleLogoPicked} aria-label="Choose a logo image" />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} loading={isUploading} loadingText="Uploading...">
              {logoUrl ? 'Change logo' : 'Upload logo'}
            </Button>
            <p className="text-xs text-gray-500">JPG, PNG, WEBP or GIF.</p>
          </div>
        </div>
        {logoError && <p className="mt-3 text-sm text-red-600" role="alert">{logoError}</p>}
      </Card>

      {jobOrderSettings && <JobOrderSettingsCard initial={jobOrderSettings} onDirtyChange={onDirtyChange} showWorkTime={showWorkTime} showPrintWork={showPrintWork} />}
      {isOwner && <ShopSettingsCard onDirtyChange={onDirtyChange} />}
    </div>
  );
};

export default GeneralSettingsTab;
