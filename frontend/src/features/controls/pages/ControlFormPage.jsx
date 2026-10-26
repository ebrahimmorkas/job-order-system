import { useEffect, useMemo, useRef, useState } from 'react';
import InputField from '../../../components/common/InputField';
import TextArea from '../../../components/common/TextArea';
import Button from '../../../components/common/Buttons';
import Checkbox from '../../../components/common/Checkbox';
import Card from '../../../components/common/Card';
import Alert from '../../../components/common/Alert';
import Badge from '../../../components/common/Badge';
import Spinner from '../../../components/common/Spinner';
import Dropdown from '../../../components/common/DropDown';
import ListItemsEditor, { checkItemName } from '../../../components/common/ListItemsEditor';
import { BackIcon } from '../../../components/common/ActionIcons';
import { useUnsavedChanges } from '../../../components/common/UnsavedChanges';
import { Radio } from '../../../components/common/Radio';
import ControlPreview from '../components/ControlPreview';
import UnitOptionsEditor from '../components/UnitOptionsEditor';
import {
  CONTROL_TYPES, TEXT_TYPES, CHOICE_TYPES, MIN_RADIO_OPTIONS, PRICE_PATTERN, QUANTITY_PATTERN, MEASUREMENT_PATTERN, WASTAGE_PATTERN, PRICE_CHARGED, isTypeFull,
} from '../controlTypes';
import * as controlsApi from '../api/controlsApi';

const COPY_SUFFIX = ' (Copy)';
const OPTION_NOUNS = {
  radio: { singular: 'choice', plural: 'choices', owner: 'radio group' },
  dropdown: { singular: 'choice', plural: 'choices', owner: 'dropdown' },
};
const EMPTY_FIELDS = { label: '', isRequired: false, placeholder: '', defaultText: '', isPrice: false, isPriceIncludedInTax: false, isQuantity: false, chargedBy: 'unit', isUnit: false, defaultChecked: false, showMasterId: '', showValueIds: [] };
// A unit's settings as typed ('' = not set).
const UNIT_FIELDS = ['measuredAs', 'rate', 'roundUpTo', 'minimumSize', 'wastagePercent'];
const textOf = (value) => (value === null || value === undefined ? '' : String(value));

const toFields = (control) => ({
  label: control.label,
  isRequired: control.isRequired,
  placeholder: control.placeholder || '',
  defaultText: control.defaultText || '',
  isPrice: !!control.isPrice,
  isPriceIncludedInTax: !!control.isPriceIncludedInTax,
  isQuantity: !!control.isQuantity,
  chargedBy: control.chargedBy || 'unit',
  isUnit: !!control.isUnit,
  defaultChecked: !!control.defaultChecked,
  showMasterId: control.showWhen?.masterId || '',
  showValueIds: control.showWhen?.valueIds || [],
});

// What gets saved, as one string - compared with the loaded one to know
// whether anything changed.
const toSnapshot = (type, fields, options) =>
  JSON.stringify([type, fields, options.map(({ _id, name, isDefault, ...unit }) => [_id, name, isDefault, ...UNIT_FIELDS.map((field) => textOf(unit[field]))])]);

// The server's field errors ({ field, message }) by field; errors on one
// choice ("options.1.name") count as errors of the choices.
const toFieldErrors = (errors) => {
  const fieldErrors = {};
  for (const { field, message } of errors || []) {
    const key = field.startsWith('options') ? 'options' : field;
    if (!fieldErrors[key]) fieldErrors[key] = message;
  }
  return fieldErrors;
};

/**
 * Create a control, save a copy of one, or edit one. Everything waits for
 * Create / Save; leaving with unsaved changes asks first. The type is picked
 * when creating and never changes afterwards.
 *
 * @param {Object} props
 * @param {'create'|'clone'|'edit'} props.mode
 * @param {string} [props.controlId] - The control to edit, or to copy (clone)
 * @param {Object} [props.limits] - The vendor's limits, known from the list (create; asked for
 *   here when the form is opened straight from its address)
 * @param {(message: string) => void} props.onDone - Back to the list after saving
 * @param {() => void} props.onBack
 * @param {boolean} [props.readOnly] - Details only (mode 'edit', nothing can be changed)
 * @param {(() => void)|null} [props.onEdit] - Details: opens the edit screen (with Edit permission)
 */
const ControlFormPage = ({ mode, controlId, limits: knownLimits = null, onDone, onBack, readOnly = false, onEdit = null }) => {
  const isEdit = mode === 'edit';
  const nextKey = useRef(0);
  const createKey = () => `new-${nextKey.current++}`;

  const firstFreeType = knownLimits?.assignedTypes.find((t) => !isTypeFull(knownLimits, t)) ?? null;
  const [isLoading, setIsLoading] = useState(mode !== 'create' || !knownLimits);
  const [loadError, setLoadError] = useState('');
  const [limits, setLimits] = useState(knownLimits);
  const [type, setType] = useState(firstFreeType);
  const [fields, setFields] = useState(EMPTY_FIELDS);
  const [options, setOptions] = useState([]);
  const [savedSnapshot, setSavedSnapshot] = useState(() => toSnapshot(firstFreeType, EMPTY_FIELDS, []));
  const [status, setStatus] = useState('A');
  const [newOption, setNewOption] = useState('');
  const [addError, setAddError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  // The masters it can be shown with ("Show only when"); none while masters are off.
  const [tagMasters, setTagMasters] = useState([]);
  // Saving, or details only: every field is off.
  const isLocked = isSaving || readOnly;

  // Create opened straight from its address: the limits the list shows.
  useEffect(() => {
    if (mode !== 'create' || knownLimits) return undefined;
    let cancelled = false;
    controlsApi
      .listControls({ limit: 1 })
      .then(({ limits: loadedLimits }) => {
        if (cancelled) return;
        const freeType = loadedLimits.assignedTypes.find((t) => !isTypeFull(loadedLimits, t)) ?? null;
        if (!freeType) {
          setLoadError('You have reached your limit for every type of control. Delete one you no longer need to add another.');
          return;
        }
        setLimits(loadedLimits);
        setType(freeType);
        setSavedSnapshot(toSnapshot(freeType, EMPTY_FIELDS, []));
      })
      .catch((err) => !cancelled && setLoadError(err.message))
      .finally(() => !cancelled && setIsLoading(false));
    return () => { cancelled = true; };
  }, [mode, knownLimits]);

  useEffect(() => {
    let cancelled = false;
    controlsApi
      .getFormData()
      .then(({ masters }) => !cancelled && setTagMasters(masters))
      // Without them the form works as before (no "Show only when").
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (mode === 'create') return undefined;
    let cancelled = false;
    controlsApi
      .getControl(controlId)
      .then(({ control, limits: loadedLimits }) => {
        if (cancelled) return;
        setLimits(loadedLimits);
        setStatus(control.status);
        const loadedFields = toFields(control);
        let loadedOptions = (control.options || []).map(({ _id, name, ...unit }) => ({
          key: _id, _id, name, isDefault: _id === control.defaultOptionId,
          measuredAs: unit.measuredAs || 'number', rate: textOf(unit.rate), roundUpTo: textOf(unit.roundUpTo), minimumSize: textOf(unit.minimumSize), wastagePercent: textOf(unit.wastagePercent),
        }));
        if (mode === 'clone') {
          // A new control with the same settings; the label must differ.
          const max = loadedLimits.maxLabelLength[control.type] ?? Infinity;
          loadedFields.label = `${control.label.slice(0, Math.max(0, max - COPY_SUFFIX.length))}${COPY_SUFFIX}`;
          loadedOptions = loadedOptions.map(({ _id, ...option }) => ({ ...option, key: `new-${nextKey.current++}` }));
          // Only one unit dropdown: the copy is a plain dropdown.
          loadedFields.isUnit = false;
        }
        setType(control.type);
        setFields(loadedFields);
        setOptions(loadedOptions);
        setSavedSnapshot(toSnapshot(control.type, loadedFields, loadedOptions));
      })
      .catch((err) => !cancelled && setLoadError(err.message))
      .finally(() => !cancelled && setIsLoading(false));
    return () => { cancelled = true; };
  }, [mode, controlId]);

  const isDirty = useMemo(
    () => !isLoading && !loadError && (newOption.trim() !== '' || toSnapshot(type, fields, options) !== savedSnapshot),
    [isLoading, loadError, newOption, type, fields, options, savedSnapshot],
  );
  const confirmLeave = useUnsavedChanges(isDirty && !isSaving);

  const isText = TEXT_TYPES.includes(type);
  const isCheckbox = type === 'checkbox';
  const isRadio = type === 'radio';
  const isDropdown = type === 'dropdown';
  const isChoice = CHOICE_TYPES.includes(type);
  // Per unit pricing on: the unit dropdown and how a price is charged per unit.
  const isPerRateOn = limits?.isPerRatePricingOn === true;
  const isUnit = isDropdown && isPerRateOn && fields.isUnit;
  const isPrice = type === 'textfield' && fields.isPrice;
  const isQuantity = type === 'textfield' && !fields.isPrice && fields.isQuantity;
  // Only with the tax feature on and the tax details of a country filled in.
  const isTaxAvailable = limits?.isTaxAvailable === true;
  // null = no limit
  const labelMax = limits?.maxLabelLength[type] ?? null;
  const placeholderMax = isText ? (limits?.maxPlaceholderLength[type] ?? null) : null;
  const textMax = isText ? (limits?.maxLength[type] ?? null) : null;
  const optionMax = (isDropdown ? limits?.maxLength.dropdownOption : limits?.maxLength.radioOption) ?? null;
  const optionsAllowed = (isDropdown ? limits?.dropdownOptionsAllowed : limits?.optionsAllowed) ?? null;
  const optionNoun = OPTION_NOUNS[type] || OPTION_NOUNS.radio;
  // "Show only when": not for the quantity or the unit (every item has them).
  const canTag = tagMasters.length > 0 && !isQuantity && !isUnit;
  const tagMaster = tagMasters.find((master) => master._id === fields.showMasterId) || null;
  // Active ones, plus an inactive one already picked.
  const tagMasterOptions = tagMasters
    .filter((master) => master.status === 'A' || master._id === fields.showMasterId)
    .map((master) => ({ value: master._id, label: master.status === 'A' ? master.name : `${master.name} (inactive)` }));
  const tagValueOptions = (tagMaster?.values || [])
    .filter((value) => value.status === 'A' || fields.showValueIds.includes(value._id))
    .map((value) => ({ value: value._id, label: value.status === 'A' ? value.name : `${value.name} (inactive)` }));

  const clearError = (field) => {
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: '' }));
    if (formError) setFormError('');
  };

  const setField = (field, value) => {
    setFields((prev) => ({ ...prev, [field]: value }));
    clearError(field);
  };

  const handleOptionsChange = (next) => {
    setOptions(next);
    clearError('options');
  };

  // A unit's settings changed (the unit dropdown).
  const setUnit = (key, changes) => {
    setOptions((prev) => prev.map((option) => (option.key === key ? { ...option, ...changes } : option)));
    Object.keys(changes).forEach((field) => clearError(`${key}.${field}`));
  };

  // The choices to save, including one typed but not added yet; null when
  // that typed choice can't be added (its error is shown).
  const collectOptions = () => {
    if (!isChoice || !newOption.trim()) return options;
    const failure = checkItemName(options, newOption, { itemsAllowed: optionsAllowed, maxLength: optionMax, noun: optionNoun });
    if (failure) {
      setAddError(failure);
      return null;
    }
    const next = [...options, { key: createKey(), name: newOption.trim(), isDefault: false, measuredAs: 'number', rate: '', roundUpTo: '', minimumSize: '', wastagePercent: '' }];
    setOptions(next);
    setNewOption('');
    return next;
  };

  const validate = (optionsToSave) => {
    const errors = {};
    const label = fields.label.trim();
    if (!type) errors.type = 'Choose a type';
    if (!label) errors.label = isCheckbox ? 'Enter the checkbox text' : 'Enter a label';
    else if (labelMax !== null && label.length > labelMax) errors.label = `At most ${labelMax} characters`;
    if (isText && placeholderMax !== null && fields.placeholder.trim().length > placeholderMax) errors.placeholder = `At most ${placeholderMax} characters`;
    if (isText && textMax !== null && fields.defaultText.length > textMax) errors.defaultText = `At most ${textMax} characters`;
    else if (isPrice && fields.defaultText.trim() && !PRICE_PATTERN.test(fields.defaultText.trim())) errors.defaultText = 'Enter an amount with at most 2 decimals, e.g. 150 or 150.50';
    else if (isQuantity && fields.defaultText.trim() && !QUANTITY_PATTERN.test(fields.defaultText.trim())) errors.defaultText = 'Enter a whole number from 1 to 999999';
    if (isRadio && optionsToSave.length < MIN_RADIO_OPTIONS) errors.options = `Add at least ${MIN_RADIO_OPTIONS} choices`;
    if (isDropdown && optionsToSave.length < 1) errors.options = 'Add at least 1 choice';
    if (isUnit) {
      for (const option of optionsToSave) {
        const rate = textOf(option.rate).trim();
        const minimum = textOf(option.minimumSize).trim();
        const wastage = textOf(option.wastagePercent).trim();
        if (rate && !PRICE_PATTERN.test(rate)) errors[`${option.key}.rate`] = 'Enter an amount with at most 2 decimals, e.g. 100';
        if (minimum && !MEASUREMENT_PATTERN.test(minimum)) errors[`${option.key}.minimumSize`] = 'Enter a number with at most 3 decimals, e.g. 1';
        if (wastage && (!WASTAGE_PATTERN.test(wastage) || Number(wastage) > 100)) errors[`${option.key}.wastagePercent`] = 'Enter a % from 0 to 100';
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    const optionsToSave = collectOptions();
    if (!optionsToSave || !validate(optionsToSave)) return;

    const payload = { type, label: fields.label.trim(), isRequired: fields.isRequired };
    if (isText) Object.assign(payload, { placeholder: fields.placeholder.trim() || null, defaultText: (isPrice || isQuantity ? fields.defaultText.trim() : fields.defaultText) || null });
    if (type === 'textfield') Object.assign(payload, { isPrice: fields.isPrice, isPriceIncludedInTax: isPrice && isTaxAvailable && fields.isPriceIncludedInTax, isQuantity });
    if (isPrice && isPerRateOn) payload.chargedBy = fields.chargedBy;
    if (isCheckbox) payload.defaultChecked = fields.defaultChecked;
    if (isDropdown && isPerRateOn) payload.isUnit = fields.isUnit;
    payload.showWhen = canTag && fields.showMasterId ? { masterId: fields.showMasterId, valueIds: fields.showValueIds } : null;
    if (isChoice) {
      payload.options = optionsToSave.map(({ _id, name, isDefault, ...unit }) => ({
        ...(_id && { _id }),
        name,
        isDefault,
        ...(isUnit && {
          measuredAs: unit.measuredAs || 'number',
          rate: textOf(unit.rate).trim() || null,
          roundUpTo: unit.roundUpTo ? Number(unit.roundUpTo) : null,
          minimumSize: textOf(unit.minimumSize).trim() || null,
          wastagePercent: textOf(unit.wastagePercent).trim() ? Number(unit.wastagePercent) : null,
        }),
      }));
    }

    setIsSaving(true);
    setFormError('');
    try {
      if (isEdit) {
        await controlsApi.updateControl(controlId, payload);
        onDone('Control saved.');
      } else {
        await controlsApi.createControl(payload);
        onDone(mode === 'clone' ? 'Copy of the control created.' : 'Control created.');
      }
    } catch (err) {
      const errors = toFieldErrors(err.errors);
      setFieldErrors(errors);
      // A message not tied to one field (e.g. the limit) goes on top.
      if (!['label', 'placeholder', 'defaultText', 'options', 'isQuantity', 'isUnit', 'showWhen'].some((field) => errors[field])) setFormError(err.message);
      setIsSaving(false);
    }
  };

  const goBack = () => confirmLeave(onBack);

  const title = { create: 'New control', clone: 'Copy control', edit: 'Edit control' }[mode];
  const submitLabel = { create: 'Create control', clone: 'Create copy', edit: 'Save changes' }[mode];

  if (isLoading) return <div className="py-24 flex justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <button type="button" onClick={goBack} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 cursor-pointer">
          <BackIcon className="w-4 h-4" /> Back to controls
        </button>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{readOnly ? 'Control details' : title}</h1>
          {mode !== 'create' && type && <Badge variant="blue">{CONTROL_TYPES[type].label}</Badge>}
          {isEdit && <Badge variant={status === 'A' ? 'green' : 'gray'} dot>{status === 'A' ? 'Active' : 'Inactive'}</Badge>}
          {readOnly && onEdit && <Button size="sm" variant="outline" className="ml-auto" onClick={onEdit}>Edit</Button>}
        </div>
        {mode === 'clone' && <p className="mt-1 text-sm text-gray-500">Change anything you need, then create the copy.</p>}
      </div>

      {loadError ? (
        <Alert variant="error">{loadError}</Alert>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          {/* Details only: a disabled fieldset turns off every field and button inside it. */}
          <fieldset disabled={readOnly} className="m-0 min-w-0 border-0 p-0 space-y-6">
          {formError && <Alert variant="error">{formError}</Alert>}

          {mode === 'create' && (
            <Card variant="outlined" title="Type" subtitle="What the person filling in the job order will use. It can't be changed later.">
              <div role="radiogroup" aria-label="Type" className="grid gap-3 sm:grid-cols-2">
                {limits.assignedTypes.map((t) => {
                  const isFull = isTypeFull(limits, t);
                  const isChosen = type === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={isChosen}
                      disabled={isFull || isLocked}
                      onClick={() => { setType(t); clearError('type'); }}
                      className={`text-left rounded-lg border p-3 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${isChosen ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                    >
                      <span className="block text-sm font-semibold text-gray-900">{CONTROL_TYPES[t].label}</span>
                      <span className="block mt-0.5 text-xs text-gray-500">{isFull ? 'The limit for this type is reached' : CONTROL_TYPES[t].hint}</span>
                    </button>
                  );
                })}
              </div>
              {fieldErrors.type && <p className="mt-2 text-sm text-red-600" role="alert">{fieldErrors.type}</p>}
            </Card>
          )}

          {type && (
            <>
              <Card variant="outlined" title="Details">
                <div className="space-y-5">
                  <InputField
                    label={isCheckbox ? 'Checkbox text' : 'Label'}
                    name="label"
                    placeholder={isCheckbox ? 'e.g. Urgent delivery' : isRadio ? 'e.g. Are you married?' : isDropdown ? 'e.g. Colour, or Unit' : 'e.g. Vehicle number'}
                    value={fields.label}
                    onChange={(e) => setField('label', e.target.value)}
                    error={fieldErrors.label}
                    maxLength={labelMax ?? undefined}
                    required
                    disabled={isLocked}
                    autoFocus={mode === 'create'}
                  />

                  {isText && (
                    <InputField
                      label="Placeholder"
                      name="placeholder"
                      placeholder={isPrice ? 'Grey hint text inside the box, e.g. Enter the amount' : 'Grey hint text inside the box, e.g. MH 12 AB 1234'}
                      value={fields.placeholder}
                      onChange={(e) => setField('placeholder', e.target.value)}
                      error={fieldErrors.placeholder}
                      maxLength={placeholderMax ?? undefined}
                      disabled={isLocked}
                    />
                  )}

                  {type === 'textfield' && (
                    <InputField
                      label={isPrice ? 'Default amount' : isQuantity ? 'Default quantity' : 'Default text'}
                      name="defaultText"
                      placeholder={isPrice ? 'e.g. 150.50 (optional)' : isQuantity ? 'e.g. 1 (optional)' : 'Filled in on a new job order (optional)'}
                      inputMode={isPrice ? 'decimal' : isQuantity ? 'numeric' : undefined}
                      value={fields.defaultText}
                      onChange={(e) => setField('defaultText', e.target.value)}
                      error={fieldErrors.defaultText}
                      maxLength={textMax ?? undefined}
                      disabled={isLocked}
                    />
                  )}
                  {type === 'textarea' && (
                    <div>
                      <TextArea
                        label="Default text"
                        name="defaultText"
                        placeholder="Filled in on a new job order (optional)"
                        value={fields.defaultText}
                        onChange={(e) => setField('defaultText', e.target.value)}
                        maxLength={textMax}
                        showCharCount={textMax !== null}
                        rows={3}
                        disabled={isLocked}
                      />
                      {fieldErrors.defaultText && <p className="mt-1 text-sm text-red-600" role="alert">{fieldErrors.defaultText}</p>}
                    </div>
                  )}
                  {isText && textMax !== null && (
                    <p className="-mt-3 text-xs text-gray-500">On the job order, at most {textMax} characters can be typed here.</p>
                  )}

                  {type === 'textfield' && (
                    <div className="space-y-3">
                      <Checkbox
                        name="isPrice"
                        label="Is this going to be price"
                        description="Only an amount can be typed here (e.g. 150.50), and it is added to the job order total."
                        checked={fields.isPrice}
                        onChange={(e) => {
                          // A price is never the quantity.
                          setFields((prev) => ({ ...prev, isPrice: e.target.checked, isPriceIncludedInTax: e.target.checked && prev.isPriceIncludedInTax, isQuantity: !e.target.checked && prev.isQuantity }));
                          clearError('defaultText');
                          clearError('isQuantity');
                        }}
                        disabled={isLocked}
                      />
                      {!isPrice && (
                        <Checkbox
                          name="isQuantity"
                          label="This is a quantity field"
                          description="Only a whole number can be typed here (e.g. 5). With Company Settings > Job orders set to 'Software calculates the price', every price of the item is rate × this quantity. Only one control can be the quantity."
                          checked={fields.isQuantity}
                          onChange={(e) => { setField('isQuantity', e.target.checked); clearError('defaultText'); }}
                          error={fieldErrors.isQuantity}
                          disabled={isLocked}
                        />
                      )}
                      {isPrice && isTaxAvailable && (
                        <div className="pl-7">
                          <Checkbox
                            name="isPriceIncludedInTax"
                            label="Include this price in tax"
                            description="Tax is charged on this amount when the job order is created."
                            checked={fields.isPriceIncludedInTax}
                            onChange={(e) => setField('isPriceIncludedInTax', e.target.checked)}
                            disabled={isLocked}
                          />
                        </div>
                      )}
                      {isPrice && isPerRateOn && (
                        <fieldset className="pl-7 min-w-0">
                          <legend className="mb-2 text-sm font-medium text-gray-700">On an item charged per unit (meter, sq ft...), this price is charged</legend>
                          <div className="space-y-2">
                            {PRICE_CHARGED.map((way) => (
                              <Radio
                                key={way.value}
                                name="chargedBy"
                                value={way.value}
                                label={way.label}
                                description={way.description}
                                checked={fields.chargedBy === way.value}
                                onChange={() => setField('chargedBy', way.value)}
                                disabled={isLocked}
                              />
                            ))}
                          </div>
                          <p className="mt-2 text-xs text-gray-500">On an item charged per piece it is always rate × quantity.</p>
                        </fieldset>
                      )}
                    </div>
                  )}

                  {isDropdown && isPerRateOn && (
                    <Checkbox
                      name="isUnit"
                      label="Use this dropdown to pick the pricing unit"
                      description="Its choices are the units an item can be charged in (e.g. sq ft, meter, cm), each with its own rate and size rules. On an item charged per unit, picking one asks the size and fills in the rate. Only one dropdown can be the pricing unit."
                      checked={fields.isUnit}
                      onChange={(e) => setField('isUnit', e.target.checked)}
                      error={fieldErrors.isUnit}
                      disabled={isLocked}
                    />
                  )}

                  {isCheckbox && (
                    <Checkbox
                      name="defaultChecked"
                      label="Ticked by default"
                      description="Already ticked on a new job order."
                      checked={fields.defaultChecked}
                      onChange={(e) => setField('defaultChecked', e.target.checked)}
                      disabled={isLocked}
                    />
                  )}

                  <Checkbox
                    name="isRequired"
                    label="Required"
                    description={isCheckbox ? 'The job order can\'t be saved unless this is ticked.' : 'The job order can\'t be saved without an answer here.'}
                    checked={fields.isRequired}
                    onChange={(e) => setField('isRequired', e.target.checked)}
                    disabled={isLocked}
                  />
                </div>
              </Card>

              {isChoice && (
                <Card variant="outlined" title={isUnit ? 'Units' : 'Choices'} subtitle={isUnit ? 'The units, e.g. sq ft, meter, cm. The default one is picked in advance on a new job order.' : 'In the order shown. The default one is picked in advance on a new job order.'}>
                  <ListItemsEditor
                    items={options}
                    onChange={handleOptionsChange}
                    createKey={createKey}
                    itemsAllowed={optionsAllowed}
                    maxLength={optionMax}
                    noun={optionNoun}
                    hasStatus={false}
                    addPlaceholder={isUnit ? 'Add a unit, e.g. sq ft' : 'Add a choice, e.g. Yes'}
                    newName={newOption}
                    onNewNameChange={setNewOption}
                    addError={addError}
                    onAddError={setAddError}
                    error={fieldErrors.options}
                    disabled={isLocked}
                  />
                </Card>
              )}

              {isUnit && (
                <Card variant="outlined" title="Unit settings" subtitle="How each unit is measured, its rate and how its size is charged.">
                  <UnitOptionsEditor options={options} onChange={setUnit} errors={fieldErrors} disabled={isLocked} />
                </Card>
              )}

              {canTag && (
                <Card variant="outlined" title="Show only when" subtitle="Optional. Ask this on an item only when a master value is picked there.">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Dropdown
                      label="Master"
                      name="showMasterId"
                      aria-label="Show only when this master is picked"
                      options={[{ value: '', label: 'Always show' }, ...tagMasterOptions]}
                      value={fields.showMasterId}
                      onChange={(value) => { setFields((prev) => ({ ...prev, showMasterId: value || '', showValueIds: [] })); clearError('showWhen'); }}
                      searchable
                      disabled={isLocked}
                      error={fieldErrors.showWhen}
                    />
                    {fields.showMasterId && (
                      <Dropdown
                        label="Values"
                        name="showValueIds"
                        aria-label="Show only with these values"
                        options={tagValueOptions}
                        multiple
                        value={fields.showValueIds}
                        onChange={(value) => { setField('showValueIds', value || []); clearError('showWhen'); }}
                        placeholder="Any value"
                        helperText="Empty = any value of the master."
                        searchable
                        disabled={isLocked}
                      />
                    )}
                  </div>
                </Card>
              )}

              <Card variant="outlined" title="Preview" subtitle="How it will look on the job order.">
                <ControlPreview type={type} options={options} {...fields} isUnit={isUnit} isPriceIncludedInTax={isTaxAvailable && fields.isPriceIncludedInTax} />
              </Card>
            </>
          )}

          {!readOnly && (
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={goBack} disabled={isSaving}>Cancel</Button>
            <Button type="submit" loading={isSaving} loadingText={isEdit ? 'Saving...' : 'Creating...'} disabled={!type}>{submitLabel}</Button>
          </div>
          )}
          </fieldset>
        </form>
      )}
    </div>
  );
};

export default ControlFormPage;
