import { useEffect, useMemo, useRef, useState } from 'react';
import InputField from '../../../components/common/InputField';
import Dropdown from '../../../components/common/DropDown';
import Button from '../../../components/common/Buttons';
import Card from '../../../components/common/Card';
import Alert from '../../../components/common/Alert';
import Spinner from '../../../components/common/Spinner';
import { BackIcon } from '../../../components/common/ActionIcons';
import { useUnsavedChanges } from '../../../components/common/UnsavedChanges';
import JobOrderSummary from '../components/JobOrderSummary';
import JobOrderItemFields from '../components/JobOrderItemFields';
import { computeTotals } from '../jobOrderTotals';
import { summaryRowsOf } from '../summaryRows';
import { PRICE_PATTERN } from '../../controls/controlTypes';
import { taxLabel } from '../../companySettings/taxRules';
import * as jobOrdersApi from '../api/jobOrdersApi';
import CustomerSearch from '../components/CustomerSearch';
import CustomerFields from '../../customers/components/CustomerFields';
import {
  EMPTY_CUSTOMER, formCustomerOf, contactErrorsOf, postalErrorOf, contactPayloadOf, addressPayloadOf,
} from '../../customers/customerFields';

// Same as the backend (constants/jobOrderConstants.js).
const JOB_ORDER_NUMBER_MAX_LENGTH = 30;
const ANSWER_MAX_LENGTH = 5000;

// Same as the backend: several countries and the address (with its country) not asked.
const NO_COUNTRY_REASON = 'No tax is charged: you have more than one country and the customer address is not asked. Turn on "Ask the customer address" in Company Settings.';

const idOf = (value) => (value ? String(value) : '');

// "<itemId>|<valueId>": the work on one value of one saved item.
const workKeyOf = (itemId, valueId) => `${idOf(itemId)}|${idOf(valueId)}`;

// A new item: each master's default value, each control's default answer.
const freshItem = ({ masters, controls }, key) => ({
  key,
  // The saved item this is ('' = a new item).
  itemId: '',
  name: '',
  // "Same as above" ticked (the name was copied from the item above once).
  sameAsAbove: false,
  picks: Object.fromEntries(masters.map((master) => [master._id, master.defaultValueId ? [master.defaultValueId] : []])),
  answers: Object.fromEntries(controls.map((control) => [control._id, {
    text: control.defaultText || '',
    checked: !!control.defaultChecked,
    optionId: control.options?.some((option) => option._id === control.defaultOptionId) ? control.defaultOptionId : '',
  }])),
  // { key, imageId, url } saved / { key, file, src, name } picked now
  images: [],
  // valueId -> the ids of the people given its work (role masters only)
  assign: {},
  // valueId -> how long they have: { amount (null = no deadline), unit }
  completeIn: {},
});

// A saved item on today's form: answers of masters, values, controls and
// choices no longer available are left out.
const savedItem = ({ masters, controls }, item, key) => {
  const savedMasters = new Map(item.masters.map((master) => [idOf(master.masterId), master.values.map((value) => idOf(value.valueId))]));
  const savedControls = new Map(item.controls.map((control) => [idOf(control.controlId), control]));
  const values = item.masters.flatMap((master) => master.values);
  return {
    key,
    itemId: idOf(item._id),
    name: item.name || '',
    sameAsAbove: false,
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
    images: item.images.map((image) => ({ key: idOf(image.imageId), imageId: idOf(image.imageId), url: image.url })),
    assign: Object.fromEntries(values.filter((value) => value.assignedTo?.length > 0).map((value) => [idOf(value.valueId), value.assignedTo.map((person) => idOf(person.userId))])),
    completeIn: Object.fromEntries(values.filter((value) => value.completeIn).map((value) => [idOf(value.valueId), { ...value.completeIn }])),
  };
};

// A new job order: one item.
const freshForm = (parts) => ({
  jobOrderNumber: '',
  customer: { ...EMPTY_CUSTOMER, countryId: parts.countries.length === 1 ? parts.countries[0]._id : '' },
  taxId: '',
  items: [freshItem(parts, 'item-0')],
});

const savedForm = (parts, jobOrder) => ({
  jobOrderNumber: jobOrder.jobOrderNumber,
  customer: formCustomerOf(parts.countries, jobOrder.customer || {}),
  taxId: idOf(jobOrder.tax?.taxId),
  items: jobOrder.items.map((item, index) => savedItem(parts, item, `item-${index}`)),
});

// "<itemId>|<valueId>" -> the people a saved job order gave that work to ({ userId, name }).
const earlierPeopleOf = (jobOrder) => new Map((jobOrder?.items || []).flatMap((item) => item.masters.flatMap((master) => master.values
  .map((value) => [workKeyOf(item._id, value.valueId), value.assignedTo || []]))));

/**
 * Create or edit a job order: the job order number (when typed by hand),
 * the customer (when asked), one or more items - each with its job name,
 * masters, controls and images (up to the vendor's limit) - the tax rate,
 * and a summary that updates as the form is filled in. Everything is
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
  // On edit: "<itemId>|<valueId>" -> the people the job order gave that work to (they may stay).
  const [earlierPeople, setEarlierPeople] = useState(() => new Map());
  // On edit: how many items it was saved with (it may keep them, even over today's limit).
  const [savedItemCount, setSavedItemCount] = useState(0);
  const [form, setForm] = useState(null);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [loadError, setLoadError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  // Previews of picked images (object URLs), freed when removed or on leaving.
  const previewUrls = useRef(new Set());
  const nextImageKey = useRef(0);
  // Keeps each item's key unique, also after one is removed.
  const nextItemKey = useRef(0);
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
        nextItemKey.current = initial.items.length;
        setParts(data);
        setEarlierPeople(earlierPeopleOf(saved?.jobOrder));
        setSavedItemCount(saved?.jobOrder.items.length || 0);
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
  // Name, phone and email (and the customer saved): the Customers feature.
  const askContact = settings?.askCustomerContact === true;
  const countries = useMemo(() => parts?.countries || [], [parts]);
  const maxItems = Math.max(settings?.maxItems ?? 1, savedItemCount);

  // userId -> name, of everyone who can be (or was) given work.
  const personNames = useMemo(() => {
    const names = new Map((parts?.workers || []).map((worker) => [worker._id, worker.name]));
    for (const people of earlierPeople.values()) for (const person of people) if (!names.has(idOf(person.userId))) names.set(idOf(person.userId), person.name);
    return names;
  }, [parts, earlierPeople]);

  // Everything worked out from the form, the way the backend does it.
  const preview = useMemo(() => {
    if (!parts || !form) return null;
    const { customer } = form;
    const country = countries.find((c) => c._id === customer.countryId) || null;
    const state = country?.states.find((s) => s._id === customer.stateId) || null;
    const city = state ? country.cities.find((c) => c._id === customer.cityId) || null : null;

    // Tax country: the customer's country, or the vendor's only country.
    const taxCountry = (askAddress && country) || (countries.length === 1 ? countries[0] : null);
    const items = form.items.map((item) => {
      const controls = [];
      for (const control of parts.controls) {
        const answer = item.answers[control._id];
        const base = { controlId: control._id, type: control.type, label: control.label };
        if (control.type === 'checkbox') controls.push({ ...base, checked: answer.checked });
        else if (control.type === 'radio') controls.push({ ...base, optionName: control.options.find((o) => o._id === answer.optionId)?.name || null });
        else if (control.isPrice) {
          const text = answer.text.trim();
          if (PRICE_PATTERN.test(text)) controls.push({ ...base, isPrice: true, isPriceIncludedInTax: control.isPriceIncludedInTax, amount: Number(text) });
        } else controls.push({ ...base, text: answer.text });
      }
      const masters = parts.masters.map((master) => ({
        masterId: master._id,
        name: master.name,
        shortName: master.shortName,
        values: master.values
          .filter((value) => item.picks[master._id].includes(value._id))
          .map((value) => ({ ...value, assignedTo: (item.assign[value._id] || []).map((userId) => ({ userId, name: personNames.get(userId) })) })),
      }));
      return { name: item.name.trim(), masters, controls };
    });
    // Every price of every item.
    const prices = items.flatMap((item) => item.controls).filter((c) => c.isPrice).map((c) => ({ amount: c.amount, isTaxed: c.isPriceIncludedInTax }));

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

    return {
      country,
      taxCountry,
      canChooseRate,
      rate,
      rows: summaryRowsOf({
        customer: {
          ...(askAddress && { postalCode: customer.postalCode, address: customer.address, countryName: country?.name, stateName: state?.name, cityName: city?.name }),
          ...(askContact && { name: customer.name.trim(), phone: customer.phone.trim(), email: customer.email.trim() }),
        },
        items,
      }, { useShortNames: settings.useShortNames }),
      currency: taxCountry?.currency || null,
      subtotal: totals.subtotal,
      tax: { isApplied: !!rate, reason, name: rate?.name, components: totals.components, taxableAmount: totals.taxableAmount, amount: totals.taxAmount },
      total: totals.total,
    };
  }, [parts, form, countries, askAddress, askContact, settings, personNames]);

  const clearError = (...fields) => {
    if (fields.some((field) => fieldErrors[field])) {
      setFieldErrors((prev) => ({ ...prev, ...Object.fromEntries(fields.map((field) => [field, ''])) }));
    }
    if (formError) setFormError('');
  };

  const setCustomer = (changes, ...fields) => {
    // Rates belong to one country: another country clears the chosen rate.
    const isNewCountry = 'countryId' in changes && changes.countryId !== form.customer.countryId;
    setForm((prev) => ({ ...prev, customer: { ...prev.customer, ...changes }, ...(isNewCountry && { taxId: '' }) }));
    clearError(...fields, ...(isNewCountry ? ['taxId'] : []));
  };

  // A saved customer picked in the search: their details fill the form.
  const pickCustomer = (picked) => {
    if (!picked) return;
    const filled = formCustomerOf(countries, { ...picked, ...picked.address });
    setCustomer(askAddress ? filled : { name: filled.name, phone: filled.phone, email: filled.email },
      ...Object.keys(filled).map((field) => `customer.${field}`));
  };

  // Changes one item: update(item) gives the fields that change.
  const updateItem = (index, update, ...fields) => {
    setForm((prev) => ({ ...prev, items: prev.items.map((item, i) => (i === index ? { ...item, ...update(item) } : item)) }));
    clearError(...fields);
  };

  // Item errors are by position: adding or removing one clears them all.
  const clearItemErrors = () => {
    setFieldErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([field]) => !field.startsWith('items'))));
    if (formError) setFormError('');
  };

  const addItem = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, freshItem(parts, `item-${nextItemKey.current++}`)] }));
    clearItemErrors();
  };

  const removeItem = (index) => {
    for (const image of form.items[index].images) {
      if (!image.src) continue;
      URL.revokeObjectURL(image.src);
      previewUrls.current.delete(image.src);
    }
    setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
    clearItemErrors();
  };

  // "Same as above": copies the job name of the item just above once (it
  // stays editable); unticking keeps the text.
  const setSameAsAbove = (index, isTicked) => updateItem(index, () => ({
    sameAsAbove: isTicked,
    ...(isTicked && { name: form.items[index - 1].name }),
  }), `items.${index}.name`);

  // Who can be given a value's work on an item: those who have it now, and
  // on edit those it was given to before (marked when they no longer have it).
  const peopleOptionsOf = (item, value) => {
    const eligible = new Set(value.workerIds || []);
    const options = (parts.workers || []).filter((worker) => eligible.has(worker._id)).map((worker) => ({ value: worker._id, label: `${worker.name} (@${worker.username})` }));
    for (const person of earlierPeople.get(workKeyOf(item.itemId, value._id)) || []) {
      const userId = idOf(person.userId);
      if (!eligible.has(userId)) options.push({ value: userId, label: `${person.name} (no longer has ${value.name})` });
    }
    return options;
  };

  const addImages = (index, files) => {
    const added = files.map((file) => {
      const src = URL.createObjectURL(file);
      previewUrls.current.add(src);
      return { key: `new-${nextImageKey.current++}`, file, src, name: file.name };
    });
    updateItem(index, (item) => ({ images: [...item.images, ...added] }), `items.${index}.images`);
  };

  const removeImage = (index, key) => {
    const image = form.items[index].images.find((i) => i.key === key);
    if (image?.src) {
      URL.revokeObjectURL(image.src);
      previewUrls.current.delete(image.src);
    }
    updateItem(index, (item) => ({ images: item.images.filter((i) => i.key !== key) }), `items.${index}.images`);
  };

  // The same checks as the backend, so most mistakes show without a round trip.
  const validate = () => {
    const errors = {};
    if (!isAutoNumber && !form.jobOrderNumber.trim()) errors.jobOrderNumber = 'Enter the job order number';
    if (askContact) {
      for (const [field, message] of Object.entries(contactErrorsOf(form.customer))) errors[`customer.${field}`] = message;
    }
    const postalError = askAddress ? postalErrorOf(preview.country, form.customer.postalCode) : '';
    if (postalError) errors['customer.postalCode'] = postalError;
    form.items.forEach((item, index) => {
      const prefix = `items.${index}.`;
      for (const master of parts.masters) {
        if (master.isRequired && item.picks[master._id].length === 0) errors[`${prefix}masters.${master._id}`] = `Pick a ${master.name}`;
      }
      for (const control of parts.controls) {
        const answer = item.answers[control._id];
        const field = `${prefix}controls.${control._id}`;
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
    });
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
      items: form.items.map((item) => ({
        itemId: item.itemId || null,
        name: item.name,
        masters: parts.masters.map((master) => {
          const valueIds = item.picks[master._id];
          const assignments = master.isRoleProvided
            ? valueIds.filter((valueId) => item.assign[valueId]?.length > 0).map((valueId) => {
              const time = item.completeIn[valueId];
              return { valueId, userIds: item.assign[valueId], completeIn: time?.amount ? { amount: time.amount, unit: time.unit } : null };
            })
            : [];
          return { masterId: master._id, valueIds, assignments };
        }),
        controls: parts.controls.map((control) => {
          const answer = item.answers[control._id];
          if (control.type === 'checkbox') return { controlId: control._id, checked: answer.checked };
          if (control.type === 'radio') return { controlId: control._id, optionId: answer.optionId || null };
          return { controlId: control._id, text: answer.text };
        }),
        keepImageIds: item.images.filter((image) => image.imageId).map((image) => image.imageId),
        newImageCount: item.images.filter((image) => image.file).length,
      })),
      taxId: preview.canChooseRate && preview.rate ? preview.rate._id : null,
    };
    // Item after item, as each item's newImageCount says.
    const files = form.items.flatMap((item) => item.images.filter((image) => image.file).map((image) => image.file));
    if (!isAutoNumber) payload.jobOrderNumber = form.jobOrderNumber.trim();
    if (askAddress || askContact) {
      payload.customer = { ...(askContact && contactPayloadOf(customer)), ...(askAddress && addressPayloadOf(customer)) };
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

  const isEmptyForm = parts.masters.length === 0 && parts.controls.length === 0;
  const imageRules = parts.images;
  const imageMax = imageRules?.maxCount ?? null;
  const imageCount = form.items.reduce((count, item) => count + item.images.length, 0);
  // Several items allowed: each card says which item it is.
  const canHaveSeveral = maxItems > 1;

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
            <Alert variant="info">There is nothing to fill in yet besides the job name. Add masters (Masters) or fields (Controls) to show them on job orders.</Alert>
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

          {(askAddress || askContact) && (
            <Card
              variant="outlined"
              title={askContact ? 'Customer' : 'Customer address'}
              subtitle={askContact ? 'All optional. With a phone or an email the customer is saved for next time.' : 'All optional.'}
            >
              <div className="space-y-5">
                {askContact && <CustomerSearch onPick={pickCustomer} disabled={isSaving} />}
                <CustomerFields
                  customer={form.customer}
                  countries={countries}
                  onChange={setCustomer}
                  errors={fieldErrors}
                  contactPrefix="customer."
                  addressPrefix="customer."
                  showContact={askContact}
                  showAddress={askAddress}
                  disabled={isSaving}
                />
              </div>
            </Card>
          )}

          {form.items.map((item, index) => (
            <JobOrderItemFields
              key={item.key}
              item={item}
              title={canHaveSeveral ? `Item ${index + 1}` : 'Details'}
              prefix={`items.${index}.`}
              parts={parts}
              errors={fieldErrors}
              onChange={(update, ...fields) => updateItem(index, update, ...fields)}
              onSameAsAbove={index > 0 ? (isTicked) => setSameAsAbove(index, isTicked) : null}
              onRemove={form.items.length > 1 ? () => removeItem(index) : null}
              peopleOptionsOf={(value) => peopleOptionsOf(item, value)}
              imageRules={imageRules}
              // The job order's limit counts every item's images.
              maxImages={imageMax === null ? null : Math.max(0, imageMax - (imageCount - item.images.length))}
              onAddImages={(files) => addImages(index, files)}
              onRemoveImage={(key) => removeImage(index, key)}
              currency={preview.currency}
              isTaxApplied={preview.tax.isApplied}
              disabled={isSaving}
            />
          ))}

          {canHaveSeveral && (
            <div className="flex flex-wrap items-center gap-3">
              {form.items.length < maxItems && (
                <Button variant="outline" onClick={addItem} disabled={isSaving}>+ Add item</Button>
              )}
              <p className="text-sm text-gray-500">
                {form.items.length} of {maxItems} items{form.items.length >= maxItems && ' - the most one job order can have'}
              </p>
            </div>
          )}
          {fieldErrors.items && <p className="text-sm text-red-600" role="alert">{fieldErrors.items}</p>}

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
