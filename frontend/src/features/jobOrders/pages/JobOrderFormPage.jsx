import { useEffect, useMemo, useRef, useState } from 'react';
import InputField from '../../../components/common/InputField';
import TextArea from '../../../components/common/TextArea';
import Dropdown from '../../../components/common/DropDown';
import Checkbox from '../../../components/common/Checkbox';
import { Radio } from '../../../components/common/Radio';
import Button from '../../../components/common/Buttons';
import Card from '../../../components/common/Card';
import Alert from '../../../components/common/Alert';
import Spinner from '../../../components/common/Spinner';
import ImageUploader from '../../../components/common/ImageUploader';
import NumberField from '../../../components/common/NumberField';
import { BackIcon } from '../../../components/common/ActionIcons';
import { useUnsavedChanges } from '../../../components/common/UnsavedChanges';
import JobOrderSummary from '../components/JobOrderSummary';
import { computeTotals } from '../jobOrderTotals';
import { summaryRowsOf, masterLabelOf } from '../summaryRows';
import { PRICE_PATTERN } from '../../controls/controlTypes';
import { taxLabel } from '../../companySettings/taxRules';
import { DURATION_UNITS, DURATION_AMOUNT_MAX } from '../workTime';
import * as jobOrdersApi from '../api/jobOrdersApi';

// Same as the backend (constants/jobOrderConstants.js).
const JOB_ORDER_NUMBER_MAX_LENGTH = 30;
const CUSTOMER_ADDRESS_MAX_LENGTH = 500;
const ANSWER_MAX_LENGTH = 5000;
const POSTAL_CODE_MAX_LENGTH = 20;

// Same as the backend: several countries and the address (with its country) not asked.
const NO_COUNTRY_REASON = 'No tax is charged: you have more than one country and the customer address is not asked. Turn on "Ask the customer address" in Company Settings.';

// The backend's format names (CompanyMaster.imageFormatsAllowed) and their types.
const IMAGE_MIME_TYPES = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

const EMPTY_CUSTOMER = { countryId: '', stateId: '', cityId: '', postalCode: '', address: '' };

const idOf = (value) => (value ? String(value) : '');

// A new job order: each master's default value, each control's default answer.
const freshForm = ({ masters, controls, countries }) => ({
  jobOrderNumber: '',
  customer: { ...EMPTY_CUSTOMER, countryId: countries.length === 1 ? countries[0]._id : '' },
  picks: Object.fromEntries(masters.map((master) => [master._id, master.defaultValueId ? [master.defaultValueId] : []])),
  answers: Object.fromEntries(controls.map((control) => [control._id, {
    text: control.defaultText || '',
    checked: !!control.defaultChecked,
    optionId: control.options?.some((option) => option._id === control.defaultOptionId) ? control.defaultOptionId : '',
  }])),
  taxId: '',
  // { key, imageId, url } saved / { key, file, src, name } picked now
  images: [],
  // valueId -> the ids of the people given its work (role masters only)
  assign: {},
  // valueId -> how long they have: { amount (null = no deadline), unit }
  completeIn: {},
});

const DEFAULT_UNIT = 'days';

// valueId -> the people a saved job order gave its work to ({ userId, name }).
const earlierPeopleOf = (jobOrder) => new Map((jobOrder?.masters || []).flatMap((master) => master.values.map((value) => [idOf(value.valueId), value.assignedTo || []])));

// A saved job order on today's form: answers of masters, values, controls
// and choices no longer available are left out.
const savedForm = ({ masters, controls, countries }, jobOrder) => {
  const savedMasters = new Map(jobOrder.masters.map((master) => [idOf(master.masterId), master.values.map((value) => idOf(value.valueId))]));
  const savedControls = new Map(jobOrder.controls.map((control) => [idOf(control.controlId), control]));
  const country = countries.find((c) => c._id === idOf(jobOrder.customer?.countryId)) || (countries.length === 1 ? countries[0] : null);
  const state = country?.states.find((s) => s._id === idOf(jobOrder.customer?.stateId));
  const city = state && country.cities.find((c) => c._id === idOf(jobOrder.customer?.cityId) && c.stateId === state._id);
  return {
    jobOrderNumber: jobOrder.jobOrderNumber,
    customer: {
      countryId: country?._id || '',
      stateId: state?._id || '',
      cityId: city?._id || '',
      postalCode: jobOrder.customer?.postalCode || '',
      address: jobOrder.customer?.address || '',
    },
    picks: Object.fromEntries(masters.map((master) => {
      const known = new Set(master.values.map((value) => value._id));
      return [master._id, (savedMasters.get(master._id) || []).filter((id) => known.has(id))];
    })),
    answers: Object.fromEntries(controls.map((control) => {
      const saved = savedControls.get(control._id) || {};
      const optionId = idOf(saved.optionId);
      return [control._id, {
        text: saved.text || '',
        checked: saved.checked === true,
        optionId: control.options?.some((option) => option._id === optionId) ? optionId : '',
      }];
    })),
    taxId: idOf(jobOrder.tax?.taxId),
    images: (jobOrder.images || []).map((image) => ({ key: idOf(image.imageId), imageId: idOf(image.imageId), url: image.url })),
    assign: Object.fromEntries([...earlierPeopleOf(jobOrder)].filter(([, people]) => people.length > 0).map(([valueId, people]) => [valueId, people.map((person) => idOf(person.userId))])),
    completeIn: Object.fromEntries(jobOrder.masters.flatMap((master) => master.values.filter((value) => value.completeIn).map((value) => [idOf(value.valueId), { ...value.completeIn }]))),
  };
};

/**
 * Create or edit a job order: the job order number (when typed by hand),
 * the customer's address (when asked), every master and control, the tax
 * rate, and a summary that updates as the form is filled in. Everything is
 * checked and worked out again by the backend on Create / Save.
 *
 * @param {Object} props
 * @param {'create'|'edit'} props.mode
 * @param {string} [props.jobOrderId] - The job order to edit
 * @param {(message: string, id: string) => void} props.onDone - After saving
 * @param {() => void} props.onBack
 */
const JobOrderFormPage = ({ mode, jobOrderId, onDone, onBack }) => {
  const isEdit = mode === 'edit';
  const [parts, setParts] = useState(null);
  // On edit: valueId -> the people the job order gave its work to (they may stay).
  const [earlierPeople, setEarlierPeople] = useState(() => new Map());
  const [form, setForm] = useState(null);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [loadError, setLoadError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  // Previews of picked images (object URLs), freed when removed or on leaving.
  const previewUrls = useRef(new Set());
  const nextImageKey = useRef(0);
  useEffect(() => {
    const urls = previewUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    Promise.all([jobOrdersApi.getFormData({ signal }), isEdit ? jobOrdersApi.getJobOrder(jobOrderId, { signal }) : null])
      .then(([data, saved]) => {
        const initial = saved ? savedForm(data, saved.jobOrder) : freshForm(data);
        setParts(data);
        setEarlierPeople(earlierPeopleOf(saved?.jobOrder));
        setForm(initial);
        setSavedSnapshot(JSON.stringify(initial));
      })
      .catch((err) => err?.name !== 'AbortError' && setLoadError(err.message));
    return () => controller.abort();
  }, [isEdit, jobOrderId]);

  const isDirty = !!form && JSON.stringify(form) !== savedSnapshot;
  const confirmLeave = useUnsavedChanges(isDirty && !isSaving);

  const settings = parts?.settings;
  const isAutoNumber = settings?.isJobOrderNumberAutoGenerated !== false;
  const askAddress = settings?.askCustomerAddress === true;
  const countries = useMemo(() => parts?.countries || [], [parts]);

  // userId -> name, of everyone who can be (or was) given work.
  const personNames = useMemo(() => {
    const names = new Map((parts?.workers || []).map((worker) => [worker._id, worker.name]));
    for (const people of earlierPeople.values()) for (const person of people) if (!names.has(idOf(person.userId))) names.set(idOf(person.userId), person.name);
    return names;
  }, [parts, earlierPeople]);

  // Everything worked out from the form, the way the backend does it.
  const preview = useMemo(() => {
    if (!parts || !form) return null;
    const { customer, picks, answers, assign } = form;
    const country = countries.find((c) => c._id === customer.countryId) || null;
    const state = country?.states.find((s) => s._id === customer.stateId) || null;
    const city = state ? country.cities.find((c) => c._id === customer.cityId) || null : null;

    // Tax country: the customer's country, or the vendor's only country.
    const taxCountry = (askAddress && country) || (countries.length === 1 ? countries[0] : null);
    const controls = [];
    for (const control of parts.controls) {
      const answer = answers[control._id];
      const base = { controlId: control._id, type: control.type, label: control.label };
      if (control.type === 'checkbox') controls.push({ ...base, checked: answer.checked });
      else if (control.type === 'radio') controls.push({ ...base, optionName: control.options.find((o) => o._id === answer.optionId)?.name || null });
      else if (control.isPrice) {
        const text = answer.text.trim();
        if (PRICE_PATTERN.test(text)) controls.push({ ...base, isPrice: true, isPriceIncludedInTax: control.isPriceIncludedInTax, amount: Number(text) });
      } else controls.push({ ...base, text: answer.text });
    }
    const prices = controls.filter((c) => c.isPrice).map((c) => ({ amount: c.amount, isTaxed: c.isPriceIncludedInTax }));

    // The rate dropdown: tax on, a country registered for tax, a price taxed.
    const canChooseRate = parts.isTaxOn && !!taxCountry?.isTaxReady && taxCountry.taxes.length > 0
      && parts.controls.some((c) => c.isPrice && c.isPriceIncludedInTax);
    let rate = null;
    let reason = null;
    if (parts.isTaxOn && prices.some((p) => p.isTaxed)) {
      if (!taxCountry) reason = askAddress ? 'Choose the customer country to charge tax.' : NO_COUNTRY_REASON;
      else if (!taxCountry.isTaxReady) reason = `You are not registered for ${taxCountry.taxName} in ${taxCountry.name}, so no tax is charged.`;
      else {
        rate = taxCountry.taxes.find((t) => t._id === form.taxId) || taxCountry.taxes.find((t) => t._id === taxCountry.defaultTaxId) || null;
        if (!rate) reason = `No tax rate is available for ${taxCountry.name}.`;
      }
    }
    // Between two states (e.g. IGST in India); an unknown customer state counts as the business's own.
    const businessStateId = taxCountry?.businessStateId || '';
    const isInterState = !!(rate && taxCountry.interStateTaxLabel && askAddress && state && businessStateId && state._id !== businessStateId);
    const totals = computeTotals({
      prices,
      tax: rate,
      decimals: taxCountry?.currency?.decimalPlaces ?? 2,
      interStateLabel: isInterState ? taxCountry.interStateTaxLabel : null,
    });

    const masters = parts.masters.map((master) => ({
      masterId: master._id,
      name: master.name,
      shortName: master.shortName,
      values: master.values
        .filter((value) => picks[master._id].includes(value._id))
        .map((value) => ({ ...value, assignedTo: (assign[value._id] || []).map((userId) => ({ userId, name: personNames.get(userId) })) })),
    }));

    return {
      country,
      taxCountry,
      canChooseRate,
      rate,
      rows: summaryRowsOf({
        customer: askAddress ? { ...customer, countryName: country?.name, stateName: state?.name, cityName: city?.name } : null,
        masters,
        controls,
      }, { useShortNames: settings.useShortNames }),
      currency: taxCountry?.currency || null,
      subtotal: totals.subtotal,
      tax: { isApplied: !!rate, reason, name: rate?.name, components: totals.components, taxableAmount: totals.taxableAmount, amount: totals.taxAmount },
      total: totals.total,
    };
  }, [parts, form, countries, askAddress, settings, personNames]);

  const clearError = (...fields) => {
    if (fields.some((field) => fieldErrors[field])) {
      setFieldErrors((prev) => ({ ...prev, ...Object.fromEntries(fields.map((field) => [field, ''])) }));
    }
    if (formError) setFormError('');
  };

  const setCustomer = (changes, ...fields) => {
    setForm((prev) => ({ ...prev, customer: { ...prev.customer, ...changes } }));
    clearError(...fields);
  };

  const setPick = (masterId, valueIds) => {
    setForm((prev) => ({ ...prev, picks: { ...prev.picks, [masterId]: valueIds } }));
    clearError(`masters.${masterId}`);
  };

  const setAssign = (masterId, valueId, userIds) => {
    setForm((prev) => {
      const assign = { ...prev.assign, [valueId]: userIds };
      if (userIds.length === 0) delete assign[valueId];
      return { ...prev, assign };
    });
    clearError(`masters.${masterId}`);
  };

  // How long the people given a value's work have (whole numbers only).
  const setCompleteIn = (masterId, valueId, changes) => {
    if (changes.amount !== undefined && changes.amount !== null && !Number.isInteger(changes.amount)) return;
    setForm((prev) => ({
      ...prev,
      completeIn: { ...prev.completeIn, [valueId]: { amount: null, unit: DEFAULT_UNIT, ...prev.completeIn[valueId], ...changes } },
    }));
    clearError(`masters.${masterId}`);
  };

  // Who can be given a value's work: those who have it now, and on edit
  // those it was given to before (marked when they no longer have it).
  const peopleOptionsOf = (value) => {
    const eligible = new Set(value.workerIds || []);
    const options = (parts.workers || []).filter((worker) => eligible.has(worker._id)).map((worker) => ({ value: worker._id, label: `${worker.name} (@${worker.username})` }));
    for (const person of earlierPeople.get(value._id) || []) {
      const userId = idOf(person.userId);
      if (!eligible.has(userId)) options.push({ value: userId, label: `${person.name} (no longer has ${value.name})` });
    }
    return options;
  };

  const addImages = (files) => {
    const added = files.map((file) => {
      const src = URL.createObjectURL(file);
      previewUrls.current.add(src);
      return { key: `new-${nextImageKey.current++}`, file, src, name: file.name };
    });
    setForm((prev) => ({ ...prev, images: [...prev.images, ...added] }));
    clearError('images');
  };

  const removeImage = (key) => {
    const image = form.images.find((i) => i.key === key);
    if (image?.src) {
      URL.revokeObjectURL(image.src);
      previewUrls.current.delete(image.src);
    }
    setForm((prev) => ({ ...prev, images: prev.images.filter((i) => i.key !== key) }));
    clearError('images');
  };

  const setAnswer = (controlId, changes) => {
    setForm((prev) => ({ ...prev, answers: { ...prev.answers, [controlId]: { ...prev.answers[controlId], ...changes } } }));
    clearError(`controls.${controlId}`);
  };

  // The same checks as the backend, so most mistakes show without a round trip.
  const validate = () => {
    const errors = {};
    if (!isAutoNumber && !form.jobOrderNumber.trim()) errors.jobOrderNumber = 'Enter the job order number';
    const postal = preview.country?.postalCode;
    const postalCode = form.customer.postalCode.trim();
    if (askAddress && postalCode && postal?.pattern && !new RegExp(postal.pattern).test(postalCode)) {
      errors['customer.postalCode'] = postal.patternMessage || `Enter a valid ${postal.label || 'postal code'}`;
    }
    for (const master of parts.masters) {
      if (master.isRequired && form.picks[master._id].length === 0) errors[`masters.${master._id}`] = `Pick a ${master.name}`;
    }
    for (const control of parts.controls) {
      const answer = form.answers[control._id];
      const field = `controls.${control._id}`;
      if (control.type === 'checkbox') {
        if (control.isRequired && !answer.checked) errors[field] = 'This must be ticked';
      } else if (control.type === 'radio') {
        if (control.isRequired && !answer.optionId) errors[field] = 'Pick one';
      } else {
        const text = control.isPrice ? answer.text.trim() : answer.text;
        const max = control.maxLength ?? ANSWER_MAX_LENGTH;
        if (!text) {
          if (control.isRequired) errors[field] = control.isPrice ? 'Enter the amount' : 'This is required';
        } else if (text.length > max) errors[field] = `At most ${max} characters`;
        else if (control.isPrice && !PRICE_PATTERN.test(text)) errors[field] = 'Enter an amount with at most 2 decimals, e.g. 150 or 150.50';
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    if (!validate()) {
      setFormError('Please fix the highlighted fields.');
      return;
    }

    const { customer } = form;
    const payload = {
      masters: parts.masters.map((master) => {
        const valueIds = form.picks[master._id];
        const assignments = master.isRoleProvided
          ? valueIds.filter((valueId) => form.assign[valueId]?.length > 0).map((valueId) => {
            const time = form.completeIn[valueId];
            return { valueId, userIds: form.assign[valueId], completeIn: time?.amount ? { amount: time.amount, unit: time.unit } : null };
          })
          : [];
        return { masterId: master._id, valueIds, assignments };
      }),
      controls: parts.controls.map((control) => {
        const answer = form.answers[control._id];
        if (control.type === 'checkbox') return { controlId: control._id, checked: answer.checked };
        if (control.type === 'radio') return { controlId: control._id, optionId: answer.optionId || null };
        return { controlId: control._id, text: answer.text };
      }),
      taxId: preview.canChooseRate && preview.rate ? preview.rate._id : null,
      keepImageIds: form.images.filter((image) => image.imageId).map((image) => image.imageId),
    };
    const files = form.images.filter((image) => image.file).map((image) => image.file);
    if (!isAutoNumber) payload.jobOrderNumber = form.jobOrderNumber.trim();
    if (askAddress) {
      payload.customer = {
        countryId: customer.countryId || null,
        stateId: customer.stateId || null,
        cityId: customer.cityId || null,
        postalCode: customer.postalCode.trim(),
        address: customer.address.trim(),
      };
    }

    setIsSaving(true);
    setFormError('');
    try {
      const result = isEdit ? await jobOrdersApi.updateJobOrder(jobOrderId, payload, files) : await jobOrdersApi.createJobOrder(payload, files);
      const { _id, jobOrderNumber } = result.jobOrder;
      onDone(isEdit ? `Job order ${jobOrderNumber} saved.` : `Job order ${jobOrderNumber} created.`, _id);
    } catch (err) {
      const errors = {};
      for (const { field, message } of err.errors || []) if (!errors[field]) errors[field] = message;
      setFieldErrors(errors);
      setFormError(err.message);
      setIsSaving(false);
    }
  };

  const goBack = () => confirmLeave(onBack);

  if (loadError) {
    return (
      <div className="max-w-3xl space-y-4">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 cursor-pointer">
          <BackIcon className="w-4 h-4" /> Back to job orders
        </button>
        <Alert variant="error">{loadError}</Alert>
      </div>
    );
  }
  if (!preview) return <div className="py-24 flex justify-center"><Spinner size="lg" /></div>;

  const { country } = preview;
  const stateOptions = (country?.states || []).map((s) => ({ value: s._id, label: s.name }));
  const cityOptions = (country?.cities || []).filter((c) => c.stateId === form.customer.stateId).map((c) => ({ value: c._id, label: c.name }));
  const postalLabel = country?.postalCode?.label || 'Postal code';
  const isEmptyForm = parts.masters.length === 0 && parts.controls.length === 0;
  const imageRules = parts.images;
  const showImages = imageRules?.isOn || form.images.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <button type="button" onClick={goBack} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 cursor-pointer">
          <BackIcon className="w-4 h-4" /> Back to job orders
        </button>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 break-all">
          {isEdit ? `Edit job order${isAutoNumber ? ` ${form.jobOrderNumber}` : ''}` : 'New job order'}
        </h1>
        {!isEdit && isAutoNumber && <p className="mt-1 text-sm text-gray-500">The job order number is given when you create it.</p>}
      </div>

      <form onSubmit={handleSubmit} noValidate className="grid gap-6 lg:grid-cols-5 lg:items-start">
        <div className="space-y-6 lg:col-span-3 min-w-0">
          {formError && <Alert variant="error">{formError}</Alert>}
          {isEmptyForm && (
            <Alert variant="info">There is nothing to fill in yet. Add masters (Masters) or fields (Controls) to show them on job orders.</Alert>
          )}

          {!isAutoNumber && (
            <Card variant="outlined" title="Job order">
              <InputField
                label="Job order number"
                name="jobOrderNumber"
                placeholder="e.g. 2026/0001"
                value={form.jobOrderNumber}
                onChange={(e) => { setForm((prev) => ({ ...prev, jobOrderNumber: e.target.value })); clearError('jobOrderNumber'); }}
                error={fieldErrors.jobOrderNumber}
                maxLength={JOB_ORDER_NUMBER_MAX_LENGTH}
                required
                disabled={isSaving}
                autoFocus={!isEdit}
              />
            </Card>
          )}

          {askAddress && (
            <Card variant="outlined" title="Customer address" subtitle="All optional.">
              <div className="grid gap-5 sm:grid-cols-2">
                <Dropdown
                  label="Country"
                  name="countryId"
                  options={countries.map((c) => ({ value: c._id, label: c.name }))}
                  value={form.customer.countryId}
                  onChange={(value) => {
                    // States, cities and rates belong to one country.
                    if ((value || '') === form.customer.countryId) return;
                    setCustomer({ countryId: value || '', stateId: '', cityId: '' }, 'customer.countryId', 'customer.stateId', 'customer.cityId', 'customer.postalCode', 'taxId');
                    setForm((prev) => ({ ...prev, taxId: '' }));
                  }}
                  placeholder={countries.length > 0 ? 'Choose the country' : 'No countries assigned to you'}
                  searchable
                  clearable={countries.length > 1}
                  error={fieldErrors['customer.countryId']}
                  disabled={isSaving || countries.length <= 1}
                  aria-label="Customer country"
                />
                <Dropdown
                  label="State"
                  name="stateId"
                  options={stateOptions}
                  value={form.customer.stateId}
                  onChange={(value) => {
                    // A city belongs to one state: choosing another state clears it.
                    if ((value || '') === form.customer.stateId) return;
                    setCustomer({ stateId: value || '', cityId: '' }, 'customer.stateId', 'customer.cityId');
                  }}
                  placeholder={country ? 'Choose the state' : 'Choose the country first'}
                  searchable
                  clearable
                  error={fieldErrors['customer.stateId']}
                  disabled={isSaving || !country}
                  aria-label="Customer state"
                />
                <Dropdown
                  label="City"
                  name="cityId"
                  options={cityOptions}
                  value={form.customer.cityId}
                  onChange={(value) => setCustomer({ cityId: value || '' }, 'customer.cityId')}
                  placeholder={form.customer.stateId ? (cityOptions.length > 0 ? 'Choose the city' : 'No cities for this state yet') : 'Choose the state first'}
                  searchable
                  clearable
                  error={fieldErrors['customer.cityId']}
                  disabled={isSaving || !form.customer.stateId || cityOptions.length === 0}
                  aria-label="Customer city"
                />
                <InputField
                  label={postalLabel}
                  name="postalCode"
                  value={form.customer.postalCode}
                  onChange={(e) => setCustomer({ postalCode: e.target.value }, 'customer.postalCode')}
                  error={fieldErrors['customer.postalCode']}
                  maxLength={POSTAL_CODE_MAX_LENGTH}
                  disabled={isSaving}
                />
                <div className="sm:col-span-2">
                  <TextArea
                    label="Full address"
                    name="address"
                    placeholder="House / shop, street, area"
                    value={form.customer.address}
                    onChange={(e) => setCustomer({ address: e.target.value }, 'customer.address')}
                    maxLength={CUSTOMER_ADDRESS_MAX_LENGTH}
                    rows={3}
                    disabled={isSaving}
                  />
                  {fieldErrors['customer.address'] && <p className="mt-1 text-sm text-red-600" role="alert">{fieldErrors['customer.address']}</p>}
                </div>
              </div>
            </Card>
          )}

          {parts.masters.length > 0 && (
            <Card variant="outlined" title="Details">
              <div className="grid gap-5 sm:grid-cols-2">
                {parts.masters.map((master) => {
                  const label = masterLabelOf(master, settings.useShortNames);
                  const options = master.values.map((value) => ({ value: value._id, label: value.name }));
                  const picked = form.picks[master._id];
                  const pickedValues = master.isRoleProvided ? master.values.filter((value) => picked.includes(value._id)) : [];
                  return (
                    <div key={master._id} className="space-y-3">
                      <Dropdown
                        label={label}
                        name={`master-${master._id}`}
                        options={options}
                        multiple={master.isMultiselectAllowed}
                        value={master.isMultiselectAllowed ? picked : picked[0] || ''}
                        onChange={(value) => setPick(master._id, master.isMultiselectAllowed ? value : (value ? [value] : []))}
                        placeholder={master.isMultiselectAllowed ? 'Choose one or more' : `Choose ${label}`}
                        searchable
                        clearable={!master.isRequired}
                        required={master.isRequired}
                        error={fieldErrors[`masters.${master._id}`]}
                        disabled={isSaving}
                        aria-label={label}
                      />
                      {pickedValues.map((value) => {
                        const people = peopleOptionsOf(value);
                        if (!parts.canAssignWork && people.length === 0) return null;
                        return (
                          <div key={value._id} className="border-l-2 border-indigo-100 pl-3">
                            {people.length > 0 ? (
                              <Dropdown
                                label={`Who does ${value.name}?`}
                                name={`assign-${value._id}`}
                                options={people}
                                multiple
                                searchable
                                value={form.assign[value._id] || []}
                                onChange={(userIds) => setAssign(master._id, value._id, userIds)}
                                placeholder="Nobody yet (optional)"
                                size="sm"
                                disabled={isSaving}
                                aria-label={`Assign ${value.name} to`}
                              />
                            ) : (
                              <p className="text-xs text-gray-500">Nobody has {value.name} in their role yet, so its work can't be given to anyone.</p>
                            )}
                            {form.assign[value._id]?.length > 0 && (
                              <div className="mt-2">
                                <div className="flex items-end gap-2">
                                  <NumberField
                                    label="Complete in"
                                    value={form.completeIn[value._id]?.amount ?? null}
                                    onChange={(amount) => setCompleteIn(master._id, value._id, { amount })}
                                    min={1}
                                    max={DURATION_AMOUNT_MAX}
                                    allowEmpty
                                    placeholder="No deadline"
                                    disabled={isSaving}
                                    className="w-32"
                                  />
                                  <div className="w-36">
                                    <Dropdown
                                      name={`complete-unit-${value._id}`}
                                      options={DURATION_UNITS}
                                      value={form.completeIn[value._id]?.unit || DEFAULT_UNIT}
                                      onChange={(unit) => setCompleteIn(master._id, value._id, { unit })}
                                      size="sm"
                                      disabled={isSaving}
                                      aria-label={`Unit for ${value.name}`}
                                    />
                                  </div>
                                </div>
                                <p className="mt-1 text-xs text-gray-400">
                                  {parts.settings.workTimeStartsOn === 'onFirstStep' ? "From each person's first step." : 'From when the work is first given.'} Leave empty for no deadline.
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {parts.controls.length > 0 && (
            <Card variant="outlined" title={parts.masters.length > 0 ? 'More details' : 'Details'}>
              <div className="space-y-5">
                {parts.controls.map((control) => {
                  const answer = form.answers[control._id];
                  const error = fieldErrors[`controls.${control._id}`];
                  const max = control.maxLength ?? ANSWER_MAX_LENGTH;

                  if (control.type === 'checkbox') {
                    return (
                      <Checkbox
                        key={control._id}
                        name={`control-${control._id}`}
                        label={control.label}
                        checked={answer.checked}
                        onChange={(e) => setAnswer(control._id, { checked: e.target.checked })}
                        required={control.isRequired}
                        error={error}
                        disabled={isSaving}
                      />
                    );
                  }

                  if (control.type === 'radio') {
                    return (
                      <fieldset key={control._id} className="min-w-0">
                        <legend className="mb-2 text-sm font-medium text-gray-700 break-words">
                          {control.label}{control.isRequired && <span className="text-red-500 ml-1">*</span>}
                        </legend>
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                          {control.options.map((option) => (
                            <Radio
                              key={option._id}
                              name={`control-${control._id}`}
                              value={option._id}
                              label={option.name}
                              checked={answer.optionId === option._id}
                              onChange={() => setAnswer(control._id, { optionId: option._id })}
                              disabled={isSaving}
                            />
                          ))}
                          {!control.isRequired && answer.optionId && (
                            <button type="button" onClick={() => setAnswer(control._id, { optionId: '' })} className="text-xs text-gray-500 hover:text-gray-900 underline cursor-pointer" disabled={isSaving}>
                              Clear
                            </button>
                          )}
                        </div>
                        {error && <p className="mt-1 text-sm text-red-600" role="alert">{error}</p>}
                      </fieldset>
                    );
                  }

                  if (control.type === 'textarea') {
                    return (
                      <div key={control._id}>
                        <TextArea
                          label={control.label}
                          name={`control-${control._id}`}
                          placeholder={control.placeholder || ''}
                          value={answer.text}
                          onChange={(e) => setAnswer(control._id, { text: e.target.value })}
                          maxLength={max}
                          showCharCount={control.maxLength !== null && control.maxLength !== undefined}
                          rows={3}
                          required={control.isRequired}
                          disabled={isSaving}
                        />
                        {error && <p className="mt-1 text-sm text-red-600" role="alert">{error}</p>}
                      </div>
                    );
                  }

                  const currency = preview.currency;
                  const isTaxed = control.isPrice && control.isPriceIncludedInTax && preview.tax.isApplied;
                  return (
                    <div key={control._id}>
                      <InputField
                        label={control.isPrice && currency?.symbol ? `${control.label} (${currency.symbol})` : control.label}
                        name={`control-${control._id}`}
                        placeholder={control.placeholder || (control.isPrice ? 'e.g. 150.50' : '')}
                        inputMode={control.isPrice ? 'decimal' : undefined}
                        value={answer.text}
                        onChange={(e) => setAnswer(control._id, { text: e.target.value })}
                        error={error}
                        maxLength={max}
                        required={control.isRequired}
                        disabled={isSaving}
                      />
                      {control.isPrice && <p className="mt-1 text-xs text-gray-500">{isTaxed ? 'Price - tax is added on it' : 'Price'}</p>}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {showImages && (
            <Card
              variant="outlined"
              title="Images"
              subtitle={imageRules?.isOn ? 'Photos of the work, e.g. the part or the drawing. Uploaded when you save.' : 'Adding images is not available for your account; you can still remove these.'}
            >
              <ImageUploader
                images={form.images.map((image) => ({ key: image.key, src: image.src || image.url, name: image.name }))}
                onAdd={addImages}
                onRemove={removeImage}
                accept={(imageRules?.formats || Object.keys(IMAGE_MIME_TYPES)).map((format) => IMAGE_MIME_TYPES[format])}
                maxSizeMB={imageRules?.maxSizeMB ?? null}
                maxCount={imageRules?.maxCount ?? null}
                canAdd={imageRules?.isOn === true}
                disabled={isSaving}
                label="job order images"
                error={fieldErrors.images}
              />
            </Card>
          )}

          {preview.canChooseRate && (
            <Card variant="outlined" title={`${preview.taxCountry.taxName} rate`} subtitle={`Charged on the prices marked for tax, in ${preview.taxCountry.name}.`}>
              <Dropdown
                name="taxId"
                options={preview.taxCountry.taxes.map((tax) => ({ value: tax._id, label: taxLabel(tax) }))}
                value={preview.rate?._id || form.taxId || preview.taxCountry.defaultTaxId || ''}
                onChange={(value) => { setForm((prev) => ({ ...prev, taxId: value || '' })); clearError('taxId'); }}
                searchable={preview.taxCountry.taxes.length > 6}
                error={fieldErrors.taxId}
                disabled={isSaving}
                aria-label="Tax rate"
                className="sm:max-w-md"
              />
            </Card>
          )}
        </div>

        <div className="lg:col-span-2 lg:sticky lg:top-6 space-y-4">
          <Card variant="outlined" title="Summary">
            <JobOrderSummary rows={preview.rows} currency={preview.currency} subtotal={preview.subtotal} tax={preview.tax} total={preview.total} />
          </Card>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={goBack} disabled={isSaving}>Cancel</Button>
            <Button type="submit" loading={isSaving} loadingText={isEdit ? 'Saving...' : 'Creating...'}>
              {isEdit ? 'Save changes' : 'Create job order'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default JobOrderFormPage;
