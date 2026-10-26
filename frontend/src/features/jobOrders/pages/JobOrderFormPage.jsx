import { useEffect, useMemo, useRef, useState } from 'react';
import InputField from '../../../components/common/InputField';
import Dropdown from '../../../components/common/DropDown';
import Button from '../../../components/common/Buttons';
import Card from '../../../components/common/Card';
import Alert from '../../../components/common/Alert';
import Spinner from '../../../components/common/Spinner';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import DatePicker from '../../../components/common/DatePicker';
import { Radio } from '../../../components/common/Radio';
import { toDayString } from '../../../components/common/DateRangeFields';
import { BackIcon } from '../../../components/common/ActionIcons';
import { useUnsavedChanges } from '../../../components/common/UnsavedChanges';
import JobOrderSummary from '../components/JobOrderSummary';
import JobOrderItemFields from '../components/JobOrderItemFields';
import { computeTotals, measurementsOf, roundTo } from '../jobOrderTotals';
import { summaryRowsOf } from '../summaryRows';
import { PRICE_PATTERN, QUANTITY_PATTERN, MEASUREMENT_PATTERN, CHOICE_TYPES } from '../../controls/controlTypes';
import {
  RATE_TIMES_QUANTITY, quantityOf, priceAmountOf, workedTotalOf, unitControlOf, itemPricingOf, chargeOf,
} from '../jobOrderItems';
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

const MEASUREMENT_NAMES = ['length', 'width', 'height'];
const AMOUNT_MESSAGE = 'Enter an amount with at most 2 decimals, e.g. 150 or 150.50';

// A typed amount as a number, or null when empty, 0 or not an amount.
const amountOf = (text) => (PRICE_PATTERN.test(text.trim()) && Number(text) > 0 ? Number(text) : null);

// A typed measurement as a number, or null when empty or not a number (counted as 1).
const measurementOf = (text) => (MEASUREMENT_PATTERN.test(text.trim()) && Number(text) > 0 ? Number(text) : null);

// "<itemId>|<valueId>": the work on one value of one saved item.
const workKeyOf = (itemId, valueId) => `${idOf(itemId)}|${idOf(valueId)}`;

// A new item: each master's default value, each control's default answer.
const freshItem = ({ masters, controls, settings }, key) => ({
  key,
  // The saved item this is ('' = a new item).
  itemId: '',
  name: '',
  // "Same as above" ticked (the name was copied from the item above once).
  sameAsAbove: false,
  // Per unit pricing: charged per piece or per unit, and the size typed.
  chargeBy: settings.chargeBy || 'piece',
  measurements: { length: '', width: '', height: '' },
  picks: Object.fromEntries(masters.map((master) => [master._id, master.defaultValueId ? [master.defaultValueId] : []])),
  answers: Object.fromEntries(controls.map((control) => [control._id, {
    text: control.defaultText || '',
    checked: !!control.defaultChecked,
    optionId: control.options?.some((option) => option._id === control.defaultOptionId) ? control.defaultOptionId : '',
    // Rate x quantity prices: the total typed by hand (isTotalEdited), else rate x quantity.
    total: '',
    isTotalEdited: false,
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
    chargeBy: item.chargeBy === 'unit' ? 'unit' : 'piece',
    measurements: Object.fromEntries(MEASUREMENT_NAMES.map((name) => {
      const value = item.measurements?.[name];
      return [name, value === null || value === undefined ? '' : String(value)];
    })),
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
        total: saved.isAmountEdited ? String(saved.amount) : '',
        isTotalEdited: saved.isAmountEdited === true,
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
  // 'YYYY-MM-DD' ('' = none)
  deliveryAt: '',
  discount: { type: 'amount', value: '' },
  advance: '',
});

const savedForm = (parts, jobOrder) => ({
  jobOrderNumber: jobOrder.jobOrderNumber,
  customer: formCustomerOf(parts.countries, jobOrder.customer || {}),
  taxId: idOf(jobOrder.tax?.taxId),
  items: jobOrder.items.map((item, index) => savedItem(parts, item, `item-${index}`)),
  deliveryAt: jobOrder.deliveryAt ? toDayString(new Date(jobOrder.deliveryAt)) : '',
  discount: { type: jobOrder.discount?.type || 'amount', value: jobOrder.discount ? String(jobOrder.discount.value) : '' },
  advance: jobOrder.advance === null || jobOrder.advance === undefined ? '' : String(jobOrder.advance),
});

// "<itemId>|<valueId>" -> the people a saved job order gave that work to ({ userId, name }).
const earlierPeopleOf = (jobOrder) => new Map((jobOrder?.items || []).flatMap((item) => item.masters.flatMap((master) => master.values
  .map((value) => [workKeyOf(item._id, value.valueId), value.assignedTo || []]))));

/**
 * Create or edit a job order: the job order number (when typed by hand),
 * the customer (when asked), one or more items - each with its job name,
 * masters, controls and images (up to the vendor's limit) - the tax rate,
 * the delivery date, discount and advance (as Company Settings asks them),
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
  // On edit: how the job order's prices are worked out (it keeps its own way).
  const [savedPriceCalculation, setSavedPriceCalculation] = useState('');
  // The quantity, a rate, the unit or the size changed while totals were typed by hand: { index, controlIds }.
  const [outdatedTotals, setOutdatedTotals] = useState(null);
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
        // Older job orders have none: the price was typed.
        setSavedPriceCalculation(saved ? saved.jobOrder.priceCalculation || 'manual' : '');
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
  // A price is its rate x the item's quantity (still editable by hand).
  const isRateTimesQuantity = (isEdit ? savedPriceCalculation : settings?.priceCalculation) === RATE_TIMES_QUANTITY;
  const isPerRateOn = settings?.isPerRatePricingOn === true;

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
      const quantity = isRateTimesQuantity ? quantityOf(parts.controls, item.answers) : 1;
      const pricing = itemPricingOf(parts.controls, item, isPerRateOn);
      const controls = [];
      for (const control of parts.controls) {
        const answer = item.answers[control._id];
        const base = { controlId: control._id, type: control.type, label: control.label };
        if (control.type === 'checkbox') controls.push({ ...base, checked: answer.checked });
        else if (CHOICE_TYPES.includes(control.type)) {
          // The unit dropdown isn't asked on a per piece item.
          if (isPerRateOn && control.isUnit && !pricing) continue;
          controls.push({ ...base, optionName: control.options.find((o) => o._id === answer.optionId)?.name || null });
        } else if (control.isPrice) {
          const charge = chargeOf(control, pricing);
          const times = quantity * charge.factor;
          const amount = priceAmountOf(answer, times, isRateTimesQuantity);
          if (amount === null) continue;
          const rate = isRateTimesQuantity ? Number(answer.text.trim()) : null;
          const isAmountEdited = isRateTimesQuantity && amount !== workedTotalOf(answer.text, times);
          controls.push({ ...base, isPrice: true, isPriceIncludedInTax: control.isPriceIncludedInTax, amount, rate, isAmountEdited, ...charge });
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
      const sized = pricing?.size ? {
        chargeBy: 'unit',
        unit: pricing.unit,
        measurements: Object.fromEntries(MEASUREMENT_NAMES.map((name) => [name, measurementOf(item.measurements[name] || '')])),
        ...pricing.size,
      } : {};
      return { name: item.name.trim(), quantity, masters, controls, ...sized };
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
    // Saved values stay while Company Settings no longer asks them (as the backend keeps them).
    const discountValue = amountOf(form.discount.value);
    const discount = discountValue === null ? null : { type: form.discount.type, value: discountValue };
    const decimals = taxCountry?.currency?.decimalPlaces ?? 2;
    const totals = computeTotals({
      prices,
      tax: rate,
      decimals,
      interStateLabel: isInterState ? taxCountry.interStateTaxLabel : null,
      discount,
      rounding: settings.roundTotalTo ? { step: settings.roundTotalTo, direction: settings.roundTotalDirection } : null,
    });
    const advance = amountOf(form.advance);

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
      discount: discount ? { ...discount, amount: totals.discountAmount } : null,
      roundOff: totals.roundOff,
      advance,
      balance: advance === null ? null : roundTo(totals.total - advance, decimals),
    };
  }, [parts, form, countries, askAddress, askContact, settings, personNames, isRateTimesQuantity, isPerRateOn]);

  const clearError = (...fields) => {
    if (fields.some((field) => fieldErrors[field])) {
      setFieldErrors((prev) => ({ ...prev, ...Object.fromEntries(fields.map((field) => [field, ''])) }));
    }
    if (formError) setFormError('');
  };

  // The delivery date, discount or advance.
  const setExtra = (changes, ...fields) => {
    setForm((prev) => ({ ...prev, ...changes }));
    clearError(...fields);
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

  // "Recalculate": the totals typed by hand go back to the worked out total.
  const recalculateTotals = () => {
    const { index, controlIds } = outdatedTotals;
    updateItem(index, (item) => ({
      answers: { ...item.answers, ...Object.fromEntries(controlIds.map((id) => [id, { ...item.answers[id], total: '', isTotalEdited: false }])) },
    }), ...controlIds.map((id) => `items.${index}.controls.${id}`));
    setOutdatedTotals(null);
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
    const unitControl = isPerRateOn ? unitControlOf(parts.controls) : undefined;
    form.items.forEach((item, index) => {
      const prefix = `items.${index}.`;
      for (const master of parts.masters) {
        if (master.isRequired && item.picks[master._id].length === 0) errors[`${prefix}masters.${master._id}`] = `Pick a ${master.name}`;
      }
      const pricing = itemPricingOf(parts.controls, item, isPerRateOn);
      for (const name of pricing?.unit ? measurementsOf(pricing.unit.measuredAs) : []) {
        const text = (item.measurements[name] || '').trim();
        if (text && measurementOf(text) === null) errors[`${prefix}measurements.${name}`] = 'Enter a number more than 0 with at most 3 decimals, e.g. 2.5';
      }
      for (const control of parts.controls) {
        const answer = item.answers[control._id];
        const field = `${prefix}controls.${control._id}`;
        const isUnit = !!unitControl && control._id === unitControl._id;
        if (control.type === 'checkbox') {
          if (control.isRequired && !answer.checked) errors[field] = 'This must be ticked';
        } else if (CHOICE_TYPES.includes(control.type)) {
          if (isUnit && item.chargeBy !== 'unit') continue;
          if (isUnit && !answer.optionId) errors[field] = 'Pick the unit';
          else if (control.isRequired && !answer.optionId) errors[field] = 'Pick one';
        } else {
          const isNumber = control.isPrice || control.isQuantity;
          const text = isNumber ? answer.text.trim() : answer.text;
          const max = control.maxLength ?? ANSWER_MAX_LENGTH;
          if (!text) {
            if (control.isRequired) errors[field] = control.isPrice ? 'Enter the amount' : control.isQuantity ? 'Enter the quantity' : 'This is required';
          } else if (text.length > max) errors[field] = `At most ${max} characters`;
          else if (control.isPrice && !PRICE_PATTERN.test(text)) errors[field] = 'Enter an amount with at most 2 decimals, e.g. 150 or 150.50';
          else if (control.isPrice && isRateTimesQuantity && answer.isTotalEdited && !PRICE_PATTERN.test(answer.total.trim())) {
            errors[field] = 'Total: Enter an amount with at most 2 decimals, e.g. 150 or 150.50';
          } else if (control.isQuantity && !QUANTITY_PATTERN.test(text)) errors[field] = 'Enter a whole number from 1 to 999999';
        }
      }
    });
    const discountText = form.discount.value.trim();
    if (discountText && !PRICE_PATTERN.test(discountText)) errors['discount.value'] = AMOUNT_MESSAGE;
    else if (form.discount.type === 'percent' && Number(discountText) > 100) errors['discount.value'] = 'A discount can be at most 100%';
    else if (form.discount.type === 'amount' && Number(discountText) > preview.subtotal) errors['discount.value'] = 'The discount can\'t be more than the subtotal';
    const advanceText = form.advance.trim();
    if (advanceText && !PRICE_PATTERN.test(advanceText)) errors.advance = AMOUNT_MESSAGE;
    else if (preview.advance !== null && preview.advance > preview.total) errors.advance = 'The advance can\'t be more than the total';
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
    const unitControl = isPerRateOn ? unitControlOf(parts.controls) : undefined;
    const payload = {
      items: form.items.map((item) => {
        const pricing = itemPricingOf(parts.controls, item, isPerRateOn);
        // Only the measurements the unit takes.
        const asked = pricing?.unit ? measurementsOf(pricing.unit.measuredAs) : [];
        return {
          itemId: item.itemId || null,
          name: item.name,
          chargeBy: pricing ? 'unit' : 'piece',
          measurements: Object.fromEntries(MEASUREMENT_NAMES.map((name) => [name, asked.includes(name) ? item.measurements[name].trim() || null : null])),
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
            if (CHOICE_TYPES.includes(control.type)) {
              // The unit dropdown isn't asked on a per piece item.
              const isHidden = !!unitControl && control._id === unitControl._id && !pricing;
              return { controlId: control._id, optionId: isHidden ? null : answer.optionId || null };
            }
            // Rate x quantity: text is the rate; total only when typed by hand.
            if (control.isPrice && isRateTimesQuantity) return { controlId: control._id, text: answer.text, total: answer.isTotalEdited ? answer.total.trim() : null };
            return { controlId: control._id, text: answer.text };
          }),
          keepImageIds: item.images.filter((image) => image.imageId).map((image) => image.imageId),
          newImageCount: item.images.filter((image) => image.file).length,
        };
      }),
      taxId: preview.canChooseRate && preview.rate ? preview.rate._id : null,
    };
    // Each only while asked (otherwise the backend keeps what was saved).
    if (settings.askDeliveryDate) payload.deliveryAt = form.deliveryAt ? new Date(`${form.deliveryAt}T00:00:00`).toISOString() : null;
    if (settings.allowDiscount) payload.discount = form.discount.value.trim() ? { type: form.discount.type, value: form.discount.value.trim() } : null;
    if (settings.askAdvance) payload.advance = form.advance.trim() || null;
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
  // The delivery date, discount and advance: while asked, or (not asked any
  // more) when the job order was saved with one - shown, not editable.
  const showDelivery = settings.askDeliveryDate || !!form.deliveryAt;
  const showDiscount = settings.allowDiscount || !!form.discount.value;
  const showAdvance = settings.askAdvance || !!form.advance;
  const keptNote = <p className="mt-1 text-xs text-gray-500">Not asked any more (Company Settings) - kept as saved.</p>;

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
              isRateTimesQuantity={isRateTimesQuantity}
              onTotalsOutdated={(controlIds) => setOutdatedTotals({ index, controlIds })}
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

          {(showDelivery || showDiscount || showAdvance) && (
            <Card variant="outlined" title="Delivery and payment">
              <div className="grid gap-5 sm:grid-cols-2">
                {showDelivery && (
                  <div>
                    <DatePicker
                      label="Delivery date (optional)"
                      name="deliveryAt"
                      value={form.deliveryAt || null}
                      onChange={(date) => setExtra({ deliveryAt: toDayString(date) }, 'deliveryAt')}
                      placeholder="No delivery date"
                      clearable
                      error={fieldErrors.deliveryAt}
                      disabled={isSaving || !settings.askDeliveryDate}
                    />
                    {!settings.askDeliveryDate && keptNote}
                  </div>
                )}
                {showDiscount && (
                  <fieldset className="min-w-0">
                    <legend className="mb-2 text-sm font-medium text-gray-700">Discount (optional)</legend>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                      {[{ value: 'amount', label: `Amount${preview.currency?.symbol ? ` (${preview.currency.symbol})` : ''}` }, { value: 'percent', label: '%' }].map((choice) => (
                        <Radio
                          key={choice.value}
                          name="discountType"
                          value={choice.value}
                          label={choice.label}
                          checked={form.discount.type === choice.value}
                          onChange={() => setExtra({ discount: { ...form.discount, type: choice.value } }, 'discount.value')}
                          disabled={isSaving || !settings.allowDiscount}
                        />
                      ))}
                    </div>
                    <InputField
                      name="discountValue"
                      placeholder={form.discount.type === 'percent' ? 'e.g. 10' : 'e.g. 100'}
                      inputMode="decimal"
                      value={form.discount.value}
                      onChange={(e) => setExtra({ discount: { ...form.discount, value: e.target.value } }, 'discount.value')}
                      error={fieldErrors['discount.value']}
                      maxLength={30}
                      disabled={isSaving || !settings.allowDiscount}
                      aria-label="Discount"
                      className="mt-2"
                    />
                    <p className="mt-1 text-xs text-gray-500">Taken off before tax.</p>
                    {!settings.allowDiscount && keptNote}
                  </fieldset>
                )}
                {showAdvance && (
                  <div>
                    <InputField
                      label={`Advance received${preview.currency?.symbol ? ` (${preview.currency.symbol})` : ''} (optional)`}
                      name="advance"
                      placeholder="e.g. 500"
                      inputMode="decimal"
                      value={form.advance}
                      onChange={(e) => setExtra({ advance: e.target.value }, 'advance')}
                      error={fieldErrors.advance}
                      maxLength={30}
                      disabled={isSaving || !settings.askAdvance}
                    />
                    {!settings.askAdvance && keptNote}
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2 lg:sticky lg:top-6 space-y-4">
          <Card variant="outlined" title="Summary">
            <JobOrderSummary
              rows={preview.rows}
              currency={preview.currency}
              subtotal={preview.subtotal}
              tax={preview.tax}
              total={preview.total}
              discount={preview.discount}
              roundOff={preview.roundOff}
              advance={preview.advance}
              balance={preview.balance}
            />
          </Card>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={goBack} disabled={isSaving}>Cancel</Button>
            <Button type="submit" loading={isSaving} loadingText={isEdit ? 'Saving...' : 'Creating...'}>
              {isEdit ? 'Save changes' : 'Create job order'}
            </Button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        isOpen={!!outdatedTotals}
        title="Work out the totals again?"
        message={`You typed ${outdatedTotals?.controlIds.length === 1 ? 'a total' : 'some totals'} by hand. The quantity, rate, unit or size changed - work ${outdatedTotals?.controlIds.length === 1 ? 'it' : 'them'} out again, or keep what you typed?`}
        confirmLabel="Recalculate"
        cancelLabel="Keep my totals"
        variant="primary"
        onConfirm={recalculateTotals}
        onCancel={() => setOutdatedTotals(null)}
      />
    </div>
  );
};

export default JobOrderFormPage;
