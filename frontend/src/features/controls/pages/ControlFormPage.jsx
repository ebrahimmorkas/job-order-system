import { useEffect, useMemo, useRef, useState } from 'react';
import InputField from '../../../components/common/InputField';
import TextArea from '../../../components/common/TextArea';
import Button from '../../../components/common/Buttons';
import Checkbox from '../../../components/common/Checkbox';
import Card from '../../../components/common/Card';
import Alert from '../../../components/common/Alert';
import Badge from '../../../components/common/Badge';
import Spinner from '../../../components/common/Spinner';
import ListItemsEditor, { checkItemName } from '../../../components/common/ListItemsEditor';
import { BackIcon } from '../../../components/common/ActionIcons';
import { useUnsavedChanges } from '../../../components/common/UnsavedChanges';
import ControlPreview from '../components/ControlPreview';
import { CONTROL_TYPES, TEXT_TYPES, MIN_RADIO_OPTIONS, PRICE_PATTERN, isTypeFull } from '../controlTypes';
import * as controlsApi from '../api/controlsApi';

const COPY_SUFFIX = ' (Copy)';
const OPTION_NOUN = { singular: 'choice', plural: 'choices', owner: 'radio group' };
const EMPTY_FIELDS = { label: '', isRequired: false, placeholder: '', defaultText: '', isPrice: false, isPriceIncludedInTax: false, defaultChecked: false };

const toFields = (control) => ({
  label: control.label,
  isRequired: control.isRequired,
  placeholder: control.placeholder || '',
  defaultText: control.defaultText || '',
  isPrice: !!control.isPrice,
  isPriceIncludedInTax: !!control.isPriceIncludedInTax,
  defaultChecked: !!control.defaultChecked,
});

// What gets saved, as one string - compared with the loaded one to know
// whether anything changed.
const toSnapshot = (type, fields, options) =>
  JSON.stringify([type, fields, options.map(({ _id, name, isDefault }) => [_id, name, isDefault])]);

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
 * @param {Object} [props.limits] - The vendor's limits, known from the list (create)
 * @param {(message: string) => void} props.onDone - Back to the list after saving
 * @param {() => void} props.onBack
 */
const ControlFormPage = ({ mode, controlId, limits: knownLimits = null, onDone, onBack }) => {
  const isEdit = mode === 'edit';
  const nextKey = useRef(0);
  const createKey = () => `new-${nextKey.current++}`;

  const firstFreeType = knownLimits?.assignedTypes.find((t) => !isTypeFull(knownLimits, t)) ?? null;
  const [isLoading, setIsLoading] = useState(mode !== 'create');
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
        let loadedOptions = (control.options || []).map(({ _id, name }) => ({
          key: _id, _id, name, isDefault: _id === control.defaultOptionId,
        }));
        if (mode === 'clone') {
          // A new control with the same settings; the label must differ.
          const max = loadedLimits.maxLabelLength[control.type] ?? Infinity;
          loadedFields.label = `${control.label.slice(0, Math.max(0, max - COPY_SUFFIX.length))}${COPY_SUFFIX}`;
          loadedOptions = loadedOptions.map(({ name, isDefault }) => ({ key: `new-${nextKey.current++}`, name, isDefault }));
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
  const isPrice = type === 'textfield' && fields.isPrice;
  // null = no limit
  const labelMax = limits?.maxLabelLength[type] ?? null;
  const placeholderMax = isText ? (limits?.maxPlaceholderLength[type] ?? null) : null;
  const textMax = isText ? (limits?.maxLength[type] ?? null) : null;
  const optionMax = limits?.maxLength.radioOption ?? null;
  const optionsAllowed = limits?.optionsAllowed ?? null;

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

  // The choices to save, including one typed but not added yet; null when
  // that typed choice can't be added (its error is shown).
  const collectOptions = () => {
    if (!isRadio || !newOption.trim()) return options;
    const failure = checkItemName(options, newOption, { itemsAllowed: optionsAllowed, maxLength: optionMax, noun: OPTION_NOUN });
    if (failure) {
      setAddError(failure);
      return null;
    }
    const next = [...options, { key: createKey(), name: newOption.trim(), isDefault: false }];
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
    if (isRadio && optionsToSave.length < MIN_RADIO_OPTIONS) errors.options = `Add at least ${MIN_RADIO_OPTIONS} choices`;
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    const optionsToSave = collectOptions();
    if (!optionsToSave || !validate(optionsToSave)) return;

    const payload = { type, label: fields.label.trim(), isRequired: fields.isRequired };
    if (isText) Object.assign(payload, { placeholder: fields.placeholder.trim() || null, defaultText: (isPrice ? fields.defaultText.trim() : fields.defaultText) || null });
    if (type === 'textfield') Object.assign(payload, { isPrice: fields.isPrice, isPriceIncludedInTax: isPrice && fields.isPriceIncludedInTax });
    if (isCheckbox) payload.defaultChecked = fields.defaultChecked;
    if (isRadio) {
      payload.options = optionsToSave.map(({ _id, name, isDefault }) => (_id ? { _id, name, isDefault } : { name, isDefault }));
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
      if (!['label', 'placeholder', 'defaultText', 'options'].some((field) => errors[field])) setFormError(err.message);
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
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {mode !== 'create' && type && <Badge variant="blue">{CONTROL_TYPES[type].label}</Badge>}
          {isEdit && <Badge variant={status === 'A' ? 'green' : 'gray'} dot>{status === 'A' ? 'Active' : 'Inactive'}</Badge>}
        </div>
        {mode === 'clone' && <p className="mt-1 text-sm text-gray-500">Change anything you need, then create the copy.</p>}
      </div>

      {loadError ? (
        <Alert variant="error">{loadError}</Alert>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-6">
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
                      disabled={isFull || isSaving}
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
                    placeholder={isCheckbox ? 'e.g. Urgent delivery' : isRadio ? 'e.g. Are you married?' : 'e.g. Vehicle number'}
                    value={fields.label}
                    onChange={(e) => setField('label', e.target.value)}
                    error={fieldErrors.label}
                    maxLength={labelMax ?? undefined}
                    required
                    disabled={isSaving}
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
                      disabled={isSaving}
                    />
                  )}

                  {type === 'textfield' && (
                    <InputField
                      label={isPrice ? 'Default amount' : 'Default text'}
                      name="defaultText"
                      placeholder={isPrice ? 'e.g. 150.50 (optional)' : 'Filled in on a new job order (optional)'}
                      inputMode={isPrice ? 'decimal' : undefined}
                      value={fields.defaultText}
                      onChange={(e) => setField('defaultText', e.target.value)}
                      error={fieldErrors.defaultText}
                      maxLength={textMax ?? undefined}
                      disabled={isSaving}
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
                        disabled={isSaving}
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
                          setFields((prev) => ({ ...prev, isPrice: e.target.checked, isPriceIncludedInTax: e.target.checked && prev.isPriceIncludedInTax }));
                          clearError('defaultText');
                        }}
                        disabled={isSaving}
                      />
                      {isPrice && (
                        <div className="pl-7">
                          <Checkbox
                            name="isPriceIncludedInTax"
                            label="Include this price in tax"
                            description="Tax is charged on this amount when the job order is created."
                            checked={fields.isPriceIncludedInTax}
                            onChange={(e) => setField('isPriceIncludedInTax', e.target.checked)}
                            disabled={isSaving}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {isCheckbox && (
                    <Checkbox
                      name="defaultChecked"
                      label="Ticked by default"
                      description="Already ticked on a new job order."
                      checked={fields.defaultChecked}
                      onChange={(e) => setField('defaultChecked', e.target.checked)}
                      disabled={isSaving}
                    />
                  )}

                  <Checkbox
                    name="isRequired"
                    label="Required"
                    description={isCheckbox ? 'The job order can\'t be saved unless this is ticked.' : 'The job order can\'t be saved without an answer here.'}
                    checked={fields.isRequired}
                    onChange={(e) => setField('isRequired', e.target.checked)}
                    disabled={isSaving}
                  />
                </div>
              </Card>

              {isRadio && (
                <Card variant="outlined" title="Choices" subtitle="In the order shown. The default one is picked in advance on a new job order.">
                  <ListItemsEditor
                    items={options}
                    onChange={handleOptionsChange}
                    createKey={createKey}
                    itemsAllowed={optionsAllowed}
                    maxLength={optionMax}
                    noun={OPTION_NOUN}
                    hasStatus={false}
                    addPlaceholder="Add a choice, e.g. Yes"
                    newName={newOption}
                    onNewNameChange={setNewOption}
                    addError={addError}
                    onAddError={setAddError}
                    error={fieldErrors.options}
                    disabled={isSaving}
                  />
                </Card>
              )}

              <Card variant="outlined" title="Preview" subtitle="How it will look on the job order.">
                <ControlPreview type={type} options={options} {...fields} />
              </Card>
            </>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={goBack} disabled={isSaving}>Cancel</Button>
            <Button type="submit" loading={isSaving} loadingText={isEdit ? 'Saving...' : 'Creating...'} disabled={!type}>{submitLabel}</Button>
          </div>
        </form>
      )}
    </div>
  );
};

export default ControlFormPage;
