import { useEffect, useMemo, useState } from 'react';
import Button from '../../../components/common/Buttons';
import Card from '../../../components/common/Card';
import Alert from '../../../components/common/Alert';
import Spinner from '../../../components/common/Spinner';
import { useUnsavedChanges } from '../../../components/common/UnsavedChanges';
import { BackIcon } from '../../../components/common/ActionIcons';
import CustomerFields from '../components/CustomerFields';
import {
  EMPTY_CUSTOMER, formCustomerOf, contactErrorsOf, postalErrorOf, contactPayloadOf, addressPayloadOf,
} from '../customerFields';
import * as customersApi from '../api/customersApi';

const formatDate = (value) => new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// The server's field errors ({ field, message }) by field ("phone", "address.cityId").
const toFieldErrors = (errors) => {
  const fieldErrors = {};
  for (const { field, message } of errors || []) {
    if (!fieldErrors[field]) fieldErrors[field] = message;
  }
  return fieldErrors;
};

/**
 * Edit a saved customer (or see their details): name, phone, email and the
 * address. Customers are only ever added from job orders; job orders already
 * saved keep the details they had. Leaving with unsaved changes asks first.
 *
 * @param {Object} props
 * @param {string} props.customerId
 * @param {(message: string) => void} props.onDone - Back to the list after saving
 * @param {() => void} props.onBack
 * @param {boolean} [props.readOnly] - Details only (nothing can be changed)
 * @param {(() => void)|null} [props.onEdit] - Details: opens the edit screen (with Edit permission)
 */
const CustomerFormPage = ({ customerId, onDone, onBack, readOnly = false, onEdit = null }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [countries, setCountries] = useState([]);
  const [form, setForm] = useState(EMPTY_CUSTOMER);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(EMPTY_CUSTOMER));
  const [lastJobOrderAt, setLastJobOrderAt] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([customersApi.getFormData(), customersApi.getCustomer(customerId)])
      .then(([formData, { customer }]) => {
        if (cancelled) return;
        setCountries(formData.countries);
        const loadedForm = formCustomerOf(formData.countries, { ...customer, ...customer.address });
        setForm(loadedForm);
        setSavedSnapshot(JSON.stringify(loadedForm));
        setLastJobOrderAt(customer.lastJobOrderAt);
      })
      .catch((err) => !cancelled && setLoadError(err.message))
      .finally(() => !cancelled && setIsLoading(false));
    return () => { cancelled = true; };
  }, [customerId]);

  const isDirty = useMemo(() => !isLoading && !loadError && JSON.stringify(form) !== savedSnapshot, [isLoading, loadError, form, savedSnapshot]);
  const confirmLeave = useUnsavedChanges(isDirty && !isSaving);

  const setCustomer = (changes, ...fields) => {
    setForm((prev) => ({ ...prev, ...changes }));
    if (fields.some((field) => fieldErrors[field])) {
      setFieldErrors((prev) => ({ ...prev, ...Object.fromEntries(fields.map((field) => [field, ''])) }));
    }
    if (formError) setFormError('');
  };

  // The same checks as the backend, so most mistakes show without a round trip.
  const validate = () => {
    const errors = contactErrorsOf(form);
    if (!form.phone.trim() && !form.email.trim()) {
      errors.phone = 'Enter a phone or an email';
      errors.email = 'Enter a phone or an email';
    }
    const postalError = postalErrorOf(countries.find((c) => c._id === form.countryId), form.postalCode);
    if (postalError) errors['address.postalCode'] = postalError;
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving || readOnly || !validate()) return;
    setIsSaving(true);
    setFormError('');
    try {
      await customersApi.updateCustomer(customerId, { ...contactPayloadOf(form), address: addressPayloadOf(form) });
      onDone('Customer saved.');
    } catch (err) {
      const errors = toFieldErrors(err.errors);
      setFieldErrors(errors);
      // A message not tied to a field goes on top.
      if (Object.keys(errors).length === 0) setFormError(err.message);
      setIsSaving(false);
    }
  };

  const goBack = () => confirmLeave(onBack);

  if (isLoading) return <div className="py-24 flex justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <button type="button" onClick={goBack} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 cursor-pointer">
          <BackIcon className="w-4 h-4" /> Back to customers
        </button>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{readOnly ? 'Customer details' : 'Edit customer'}</h1>
          {readOnly && onEdit && <Button size="sm" variant="outline" className="ml-auto" onClick={onEdit}>Edit</Button>}
        </div>
        {lastJobOrderAt && <p className="mt-1 text-sm text-gray-500">Last job order on {formatDate(lastJobOrderAt)}.</p>}
      </div>

      {loadError ? (
        <Alert variant="error">{loadError}</Alert>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {formError && <Alert variant="error">{formError}</Alert>}

          <Card
            variant="outlined"
            title="Customer"
            subtitle={readOnly ? undefined : 'A phone or an email is needed. Job orders already saved keep the details they had.'}
          >
            <CustomerFields
              customer={form}
              countries={countries}
              onChange={setCustomer}
              errors={fieldErrors}
              addressPrefix="address."
              disabled={isSaving || readOnly}
            />
          </Card>

          {!readOnly && (
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={goBack} disabled={isSaving}>Cancel</Button>
              <Button type="submit" loading={isSaving} loadingText="Saving...">Save changes</Button>
            </div>
          )}
        </form>
      )}
    </div>
  );
};

export default CustomerFormPage;
