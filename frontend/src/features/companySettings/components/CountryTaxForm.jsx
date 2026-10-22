import { useEffect, useMemo, useState } from 'react';
import InputField from '../../../components/common/InputField';
import Dropdown from '../../../components/common/DropDown';
import Checkbox from '../../../components/common/Checkbox';
import Button from '../../../components/common/Buttons';
import Card from '../../../components/common/Card';
import Alert from '../../../components/common/Alert';
import { useToast } from '../../../components/common/Toast';
import { checkTaxDetails, taxLabel } from '../taxRules';
import * as companySettingsApi from '../api/companySettingsApi';

const ADDRESS_LINE_MAX_LENGTH = 150;
const POSTAL_CODE_MAX_LENGTH = 20;

const toForm = (details) => ({
  line1: details.address.line1 || '',
  line2: details.address.line2 || '',
  stateId: details.address.stateId || '',
  cityId: details.address.cityId || '',
  postalCode: details.address.postalCode || '',
  isTaxRegistered: details.isTaxRegistered,
  taxFieldValues: { ...details.taxFieldValues },
  defaultTaxId: details.defaultTaxId || '',
});

// What gets saved, as one string - compared with the saved one to know
// whether anything changed. Tax fields count only while registered.
const toSnapshot = (form) => JSON.stringify({ ...form, taxFieldValues: form.isTaxRegistered ? form.taxFieldValues : {} });

/**
 * One country of Company Settings > Tax: the business address there, the
 * tax registration (the country's own fields) and the rate picked in
 * advance on a new job order.
 *
 * @param {Object} props
 * @param {Object} props.country - From GET /company-settings/tax
 * @param {(countryId: string, result: { details, isTaxReady }) => void} props.onSaved
 * @param {(key: string, isDirty: boolean) => void} props.onDirtyChange
 */
const CountryTaxForm = ({ country, onSaved, onDirtyChange }) => {
  const toast = useToast();
  const [saved, setSaved] = useState(() => toForm(country.details));
  const [form, setForm] = useState(saved);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = toSnapshot(form) !== toSnapshot(saved);
  useEffect(() => { onDirtyChange(`tax-${country._id}`, isDirty); }, [isDirty, country._id, onDirtyChange]);

  const stateOptions = useMemo(() => country.states.map((s) => ({ value: s._id, label: s.name })), [country.states]);
  const cityOptions = useMemo(
    () => country.cities.filter((c) => c.stateId === form.stateId).map((c) => ({ value: c._id, label: c.name })),
    [country.cities, form.stateId],
  );
  const platformDefault = country.taxes.find((t) => t.isDefault);
  const taxOptions = useMemo(() => [
    { value: '', label: platformDefault ? `Platform default - ${taxLabel(platformDefault)}` : 'No default' },
    ...country.taxes.map((t) => ({ value: t._id, label: taxLabel(t) })),
  ], [country.taxes, platformDefault]);

  const clear = (...fields) => {
    if (fields.some((f) => errors[f])) setErrors((prev) => { const next = { ...prev }; fields.forEach((f) => delete next[f]); return next; });
    if (formError) setFormError('');
  };
  const set = (field, value, errorKey = `address.${field}`) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    clear(errorKey);
  };
  const setTaxField = (key, value) => {
    setForm((prev) => ({ ...prev, taxFieldValues: { ...prev.taxFieldValues, [key]: value.toUpperCase() } }));
    clear(`taxFieldValues.${key}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    const found = checkTaxDetails(country, form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setIsSaving(true);
    setFormError('');
    try {
      const result = await companySettingsApi.updateTaxDetails(country._id, {
        address: {
          line1: form.line1.trim() || null,
          line2: form.line2.trim() || null,
          stateId: form.stateId || null,
          cityId: form.cityId || null,
          postalCode: form.postalCode.trim() || null,
        },
        isTaxRegistered: form.isTaxRegistered,
        // Not registered: no registration numbers kept.
        taxFieldValues: form.isTaxRegistered ? form.taxFieldValues : {},
        defaultTaxId: form.defaultTaxId || null,
      });
      const next = toForm(result.details);
      setSaved(next);
      setForm(next);
      onSaved(country._id, result);
      toast.success(`Tax details for ${country.name} saved.`);
    } catch (err) {
      const fieldErrors = {};
      for (const { field, message } of err.errors || []) if (!fieldErrors[field]) fieldErrors[field] = message;
      setErrors(fieldErrors);
      if (Object.keys(fieldErrors).length === 0) setFormError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const postal = country.postalCode || {};
  const currency = country.currency;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {formError && <Alert variant="error">{formError}</Alert>}

      <Card variant="outlined" title={`Business address in ${country.name}`} subtitle={form.isTaxRegistered ? 'Needed while you are registered for tax here.' : 'Optional until you are registered for tax here.'}>
        <div className="space-y-5">
          <InputField
            label="Address line 1"
            name="line1"
            placeholder="Building, street"
            value={form.line1}
            onChange={(e) => set('line1', e.target.value)}
            error={errors['address.line1']}
            maxLength={ADDRESS_LINE_MAX_LENGTH}
            required={form.isTaxRegistered}
            disabled={isSaving}
          />
          <InputField
            label="Address line 2"
            name="line2"
            placeholder="Area, landmark (optional)"
            value={form.line2}
            onChange={(e) => set('line2', e.target.value)}
            error={errors['address.line2']}
            maxLength={ADDRESS_LINE_MAX_LENGTH}
            disabled={isSaving}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <Dropdown
              label="State"
              name="stateId"
              options={stateOptions}
              value={form.stateId}
              onChange={(value) => {
                // A city belongs to one state: choosing another state clears it.
                setForm((prev) => ({ ...prev, stateId: value || '', cityId: value === prev.stateId ? prev.cityId : '' }));
                clear('address.stateId', 'address.cityId');
              }}
              placeholder="Choose the state"
              searchable
              required={form.isTaxRegistered}
              error={errors['address.stateId']}
              disabled={isSaving}
              aria-label={`State in ${country.name}`}
            />
            <Dropdown
              label="City"
              name="cityId"
              options={cityOptions}
              value={form.cityId}
              onChange={(value) => set('cityId', value || '')}
              placeholder={form.stateId ? (cityOptions.length > 0 ? 'Choose the city' : 'No cities for this state yet') : 'Choose the state first'}
              searchable
              required={form.isTaxRegistered}
              error={errors['address.cityId']}
              disabled={isSaving || !form.stateId || cityOptions.length === 0}
              aria-label={`City in ${country.name}`}
            />
          </div>
          <InputField
            label={postal.label || 'Postal code'}
            name="postalCode"
            value={form.postalCode}
            onChange={(e) => set('postalCode', e.target.value)}
            error={errors['address.postalCode']}
            maxLength={POSTAL_CODE_MAX_LENGTH}
            inputMode="numeric"
            required={form.isTaxRegistered && postal.isRequired}
            disabled={isSaving}
            className="sm:max-w-xs"
          />
        </div>
      </Card>

      <Card variant="outlined" title={`${country.taxName} registration`} subtitle={`Tax is charged on job orders for ${country.name} only while you are registered here.`}>
        <div className="space-y-5">
          <Checkbox
            name="isTaxRegistered"
            label={`I am registered for ${country.taxName} in ${country.name}`}
            checked={form.isTaxRegistered}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, isTaxRegistered: e.target.checked }));
              setErrors({});
            }}
            disabled={isSaving}
          />
          {form.isTaxRegistered && country.taxFields.map((field) => (
            <InputField
              key={field.key}
              label={field.label}
              name={`taxField-${field.key}`}
              placeholder={field.placeholder || ''}
              value={form.taxFieldValues[field.key] || ''}
              onChange={(e) => setTaxField(field.key, e.target.value)}
              error={errors[`taxFieldValues.${field.key}`]}
              maxLength={field.maxLength || undefined}
              required={field.isRequired}
              disabled={isSaving}
              className="sm:max-w-sm"
            />
          ))}
        </div>
      </Card>

      {country.taxes.length > 0 && (
        <Card variant="outlined" title="Default tax rate" subtitle="Picked in advance on a new job order. You can choose another rate on the job order itself.">
          <Dropdown
            name="defaultTaxId"
            options={taxOptions}
            value={form.defaultTaxId}
            onChange={(value) => set('defaultTaxId', value || '', 'defaultTaxId')}
            error={errors.defaultTaxId}
            disabled={isSaving}
            aria-label={`Default tax rate in ${country.name}`}
            className="sm:max-w-md"
          />
          {currency && <p className="mt-3 text-xs text-gray-500">Amounts in {country.name} are in {currency.code} ({currency.symbol}). Prices are entered before tax; the tax is added on top.</p>}
        </Card>
      )}

      <div className="flex justify-end">
        <Button type="submit" loading={isSaving} loadingText="Saving..." disabled={!isDirty}>Save {country.name}</Button>
      </div>
    </form>
  );
};

export default CountryTaxForm;
