import { useRef } from 'react';
import InputField from '../../../components/common/InputField';
import TextArea from '../../../components/common/TextArea';
import Dropdown from '../../../components/common/DropDown';
import Checkbox from '../../../components/common/Checkbox';
import { Radio } from '../../../components/common/Radio';
import Button from '../../../components/common/Buttons';
import Card from '../../../components/common/Card';
import ImageUploader from '../../../components/common/ImageUploader';
import NumberField from '../../../components/common/NumberField';
import { TrashIcon } from '../../../components/common/ActionIcons';
import { masterLabelOf } from '../summaryRows';
import { DURATION_UNITS, DURATION_AMOUNT_MAX } from '../workTime';
import { JOB_NAME_MAX_LENGTH, quantityOf, workedTotalOf, unitControlOf, itemPricingOf, chargeOf } from '../jobOrderItems';
import { measurementsOf, formatSize } from '../jobOrderTotals';

const MEASUREMENT_LABELS = { length: 'Length', width: 'Width', height: 'Height' };
const CHARGE_CHOICES = [{ value: 'piece', label: 'Per piece' }, { value: 'unit', label: 'Per unit' }];

// Same as the backend (constants/jobOrderConstants.js).
const ANSWER_MAX_LENGTH = 5000;
const DEFAULT_UNIT = 'days';

// The backend's format names (CompanyMaster.imageFormatsAllowed) and their types.
const IMAGE_MIME_TYPES = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

/**
 * One item of the job order form: its job name ("Same as above" from the
 * second item copies the name of the item above, still editable), every
 * master (with who does each picked value of a role master, and by when),
 * every control and its images. With prices worked out as rate x quantity,
 * a price shows its rate and its total (rate x the item's quantity, still
 * editable by hand). With per unit pricing, an item is charged per piece or
 * per unit: per unit it asks the unit (the unit dropdown) and the size, and
 * the rate is multiplied by the size too.
 *
 * @param {Object} props
 * @param {Object} props.item - { key, itemId, name, sameAsAbove, chargeBy, measurements, picks, answers, images, assign, completeIn }
 * @param {string} props.title - The card's title, e.g. "Item 2"
 * @param {string} props.prefix - Its field error keys start with this, e.g. "items.1."
 * @param {Object} props.parts - The form data: { masters, controls, workers, canAssignWork, settings }
 * @param {Object} props.errors - Error key -> message
 * @param {(update: (item: Object) => Object, ...errorKeys: string[]) => void} props.onChange - Changes this item; the error keys to clear
 * @param {((isTicked: boolean) => void)|null} props.onSameAsAbove - null on the first item
 * @param {(() => void)|null} props.onRemove - null when it is the only item
 * @param {(value: Object) => Array<{ value, label }>} props.peopleOptionsOf - Who can be given a value's work
 * @param {Object|null} props.imageRules - { isOn, maxSizeMB, formats }
 * @param {number|null} props.maxImages - How many images this item may have now (the rest of the job order's limit)
 * @param {(files: File[]) => void} props.onAddImages
 * @param {(key: string) => void} props.onRemoveImage
 * @param {Object|null} props.currency - The tax country's
 * @param {boolean} props.isTaxApplied - Tax is charged on this job order
 * @param {boolean} props.isRateTimesQuantity - Prices are rate x quantity
 * @param {(controlIds: string[]) => void} props.onTotalsOutdated - The quantity, a rate, the unit or the size changed while these prices have totals typed by hand
 * @param {boolean} props.disabled
 */
const JobOrderItemFields = ({
  item, title, prefix, parts, errors, onChange, onSameAsAbove, onRemove, peopleOptionsOf,
  imageRules, maxImages, onAddImages, onRemoveImage, currency, isTaxApplied, isRateTimesQuantity, onTotalsOutdated, disabled,
}) => {
  const { settings } = parts;
  const showImages = imageRules?.isOn || item.images.length > 0;
  const quantity = isRateTimesQuantity ? quantityOf(parts.controls, item.answers) : 1;
  // The quantity or rate when its field got the focus: changed on leaving it,
  // totals typed by hand may need working out again.
  const focusedText = useRef('');

  // Per unit pricing: the unit dropdown and how this item is charged.
  const unitControl = settings.isPerRatePricingOn ? unitControlOf(parts.controls) : undefined;
  const pricing = itemPricingOf(parts.controls, item, settings.isPerRatePricingOn);

  const flagEdited = (affected) => {
    if (!isRateTimesQuantity) return;
    const edited = affected.filter((entry) => item.answers[entry._id].isTotalEdited).map((entry) => entry._id);
    if (edited.length > 0) onTotalsOutdated(edited);
  };

  // The prices the size changes (not the ones charged per piece).
  const sizedPrices = () => parts.controls.filter((entry) => entry.isPrice && entry.chargedBy !== 'piece');

  const checkTotals = (control, text) => {
    if (!isRateTimesQuantity || text.trim() === focusedText.current.trim()) return;
    flagEdited(control.isQuantity ? parts.controls.filter((entry) => entry.isPrice) : [control]);
  };

  const setChargeBy = (chargeBy) => {
    if (chargeBy === item.chargeBy) return;
    onChange(() => ({ chargeBy }), `${prefix}chargeBy`);
    flagEdited(parts.controls.filter((entry) => entry.isPrice));
  };

  // Picking a unit fills its rate in the first price charged per unit, when
  // that rate is empty or still the rate of the unit picked before.
  const setUnit = (optionId) => {
    onChange((prev) => {
      const answers = { ...prev.answers, [unitControl._id]: { ...prev.answers[unitControl._id], optionId } };
      const before = unitControl.options.find((option) => option._id === prev.answers[unitControl._id]?.optionId);
      const after = unitControl.options.find((option) => option._id === optionId);
      const ratePrice = isRateTimesQuantity && parts.controls.find((entry) => entry.isPrice && (entry.chargedBy || 'unit') === 'unit');
      if (ratePrice && after && after.rate !== null && after.rate !== undefined) {
        const text = prev.answers[ratePrice._id].text.trim();
        const isBeforeRate = before && before.rate !== null && before.rate !== undefined && Number(text) === Number(before.rate);
        if (!text || isBeforeRate) answers[ratePrice._id] = { ...answers[ratePrice._id], text: String(after.rate) };
      }
      return { answers };
    }, `${prefix}controls.${unitControl._id}`);
    if (optionId !== (item.answers[unitControl._id]?.optionId || '')) flagEdited(sizedPrices());
  };

  const setMeasurement = (name, text) => onChange((prev) => ({ measurements: { ...prev.measurements, [name]: text } }), `${prefix}measurements.${name}`);

  // "Rate per sq ft" / "Rate per running length" / "Rate per piece" on a per unit item.
  const rateLabelOf = (chargedBy) => {
    if (chargedBy === 'edge') return 'Rate per running length';
    if (chargedBy === 'piece') return 'Rate per piece';
    return pricing?.unit ? `Rate per ${pricing.unit.name}` : 'Rate per unit';
  };

  // The unit dropdown, the size it asks and the size charged.
  const renderUnit = (control, error) => {
    const unit = pricing?.unit || null;
    const names = unit ? measurementsOf(unit.measuredAs) : [];
    const size = pricing?.size;
    return (
      <div key={control._id} className="space-y-3">
        <Dropdown
          label={control.label}
          name={`control-${item.key}-${control._id}`}
          options={control.options.map((option) => ({ value: option._id, label: option.name }))}
          value={item.answers[control._id]?.optionId || ''}
          onChange={(value) => setUnit(value || '')}
          placeholder="Pick the unit"
          required
          error={error}
          disabled={disabled}
          aria-label={control.label}
        />
        {unit && (
          <div className={`grid gap-3 ${names.length === 3 ? 'sm:grid-cols-3' : names.length === 2 ? 'sm:grid-cols-2' : ''}`}>
            {names.map((name) => (
              <InputField
                key={name}
                label={names.length === 1 ? `Size (${unit.name})` : MEASUREMENT_LABELS[name]}
                name={`measure-${item.key}-${name}`}
                placeholder={names.length === 1 ? 'e.g. 2.5' : `${MEASUREMENT_LABELS[name]}, e.g. 2.5`}
                inputMode="decimal"
                value={item.measurements[name] || ''}
                onChange={(e) => setMeasurement(name, e.target.value)}
                onFocus={() => { focusedText.current = item.measurements[name] || ''; }}
                onBlur={(e) => { if (e.target.value.trim() !== focusedText.current.trim()) flagEdited(sizedPrices()); }}
                error={errors[`${prefix}measurements.${name}`]}
                maxLength={10}
                disabled={disabled}
              />
            ))}
          </div>
        )}
        {size && (
          <p className="text-xs text-gray-500">
            Size {formatSize(size.size)} {unit.name}
            {size.chargeableSize !== size.size && ` · charged ${formatSize(size.chargeableSize)} ${unit.name}`}
            {size.edgeLength !== null && ` · edge ${formatSize(size.edgeLength)}`}
            {' '}(per piece)
          </p>
        )}
      </div>
    );
  };

  const setPick = (masterId, valueIds) => onChange((prev) => ({ picks: { ...prev.picks, [masterId]: valueIds } }), `${prefix}masters.${masterId}`);

  const setAssign = (masterId, valueId, userIds) => onChange((prev) => {
    const assign = { ...prev.assign, [valueId]: userIds };
    if (userIds.length === 0) delete assign[valueId];
    return { assign };
  }, `${prefix}masters.${masterId}`);

  // How long the people given a value's work have (whole numbers only).
  const setCompleteIn = (masterId, valueId, changes) => {
    if (changes.amount !== undefined && changes.amount !== null && !Number.isInteger(changes.amount)) return;
    onChange((prev) => ({
      completeIn: { ...prev.completeIn, [valueId]: { amount: null, unit: DEFAULT_UNIT, ...prev.completeIn[valueId], ...changes } },
    }), `${prefix}masters.${masterId}`);
  };

  const setAnswer = (controlId, changes) => onChange((prev) => ({ answers: { ...prev.answers, [controlId]: { ...prev.answers[controlId], ...changes } } }), `${prefix}controls.${controlId}`);

  return (
    <Card
      variant="outlined"
      title={title}
      headerActions={onRemove && (
        <Button size="sm" variant="ghost" leftIcon={<TrashIcon className="w-4 h-4" />} onClick={onRemove} disabled={disabled} aria-label={`Remove ${title}`}>
          Remove
        </Button>
      )}
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <InputField
            label="Job name"
            name={`jobName-${item.key}`}
            placeholder="e.g. Round glass cutting (optional)"
            value={item.name}
            onChange={(e) => onChange(() => ({ name: e.target.value }), `${prefix}name`)}
            error={errors[`${prefix}name`]}
            maxLength={JOB_NAME_MAX_LENGTH}
            disabled={disabled}
          />
          {onSameAsAbove && (
            <Checkbox
              name={`sameAsAbove-${item.key}`}
              label="Same as above"
              checked={item.sameAsAbove}
              onChange={(e) => onSameAsAbove(e.target.checked)}
              disabled={disabled}
            />
          )}
        </div>

        {unitControl && (
          <fieldset className="min-w-0">
            <legend className="mb-2 text-sm font-medium text-gray-700">Charged</legend>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {CHARGE_CHOICES.map((choice) => (
                <Radio
                  key={choice.value}
                  name={`chargeBy-${item.key}`}
                  value={choice.value}
                  label={choice.label}
                  checked={item.chargeBy === choice.value}
                  onChange={() => setChargeBy(choice.value)}
                  disabled={disabled}
                />
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {item.chargeBy === 'unit' ? `Pick the ${unitControl.label.toLowerCase()} and the size; the rate is multiplied by the size.` : 'One price per piece, whatever the size.'}
            </p>
            {errors[`${prefix}chargeBy`] && <p className="mt-1 text-sm text-red-600" role="alert">{errors[`${prefix}chargeBy`]}</p>}
          </fieldset>
        )}

        {parts.masters.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2">
            {parts.masters.map((master) => {
              const label = masterLabelOf(master, settings.useShortNames);
              const options = master.values.map((value) => ({ value: value._id, label: value.name }));
              const picked = item.picks[master._id];
              const pickedValues = master.isRoleProvided ? master.values.filter((value) => picked.includes(value._id)) : [];
              return (
                <div key={master._id} className="space-y-3">
                  <Dropdown
                    label={label}
                    name={`master-${item.key}-${master._id}`}
                    options={options}
                    multiple={master.isMultiselectAllowed}
                    value={master.isMultiselectAllowed ? picked : picked[0] || ''}
                    onChange={(value) => setPick(master._id, master.isMultiselectAllowed ? value : (value ? [value] : []))}
                    placeholder={master.isMultiselectAllowed ? 'Choose one or more' : `Choose ${label}`}
                    searchable
                    clearable={!master.isRequired}
                    required={master.isRequired}
                    error={errors[`${prefix}masters.${master._id}`]}
                    disabled={disabled}
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
                            name={`assign-${item.key}-${value._id}`}
                            options={people}
                            multiple
                            searchable
                            value={item.assign[value._id] || []}
                            onChange={(userIds) => setAssign(master._id, value._id, userIds)}
                            placeholder="Nobody yet (optional)"
                            size="sm"
                            disabled={disabled}
                            aria-label={`Assign ${value.name} to`}
                          />
                        ) : (
                          <p className="text-xs text-gray-500">Nobody has {value.name} in their role yet, so its work can't be given to anyone.</p>
                        )}
                        {item.assign[value._id]?.length > 0 && (
                          <div className="mt-2">
                            <div className="flex items-end gap-2">
                              <NumberField
                                label="Complete in"
                                value={item.completeIn[value._id]?.amount ?? null}
                                onChange={(amount) => setCompleteIn(master._id, value._id, { amount })}
                                min={1}
                                max={DURATION_AMOUNT_MAX}
                                allowEmpty
                                placeholder="No deadline"
                                disabled={disabled}
                                className="w-32"
                              />
                              <div className="w-36">
                                <Dropdown
                                  name={`complete-unit-${item.key}-${value._id}`}
                                  options={DURATION_UNITS}
                                  value={item.completeIn[value._id]?.unit || DEFAULT_UNIT}
                                  onChange={(unit) => setCompleteIn(master._id, value._id, { unit })}
                                  size="sm"
                                  disabled={disabled}
                                  aria-label={`Unit for ${value.name}`}
                                />
                              </div>
                            </div>
                            <p className="mt-1 text-xs text-gray-400">
                              {settings.workTimeStartsOn === 'onFirstStep' ? "From each person's first step." : 'From when the work is first given.'} Leave empty for no deadline.
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
        )}

        {parts.controls.length > 0 && (
          <div className="space-y-5">
            {parts.controls.map((control) => {
              const answer = item.answers[control._id];
              const error = errors[`${prefix}controls.${control._id}`];
              const max = control.maxLength ?? ANSWER_MAX_LENGTH;
              const name = `control-${item.key}-${control._id}`;

              if (control.type === 'checkbox') {
                return (
                  <Checkbox
                    key={control._id}
                    name={name}
                    label={control.label}
                    checked={answer.checked}
                    onChange={(e) => setAnswer(control._id, { checked: e.target.checked })}
                    required={control.isRequired}
                    error={error}
                    disabled={disabled}
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
                          name={name}
                          value={option._id}
                          label={option.name}
                          checked={answer.optionId === option._id}
                          onChange={() => setAnswer(control._id, { optionId: option._id })}
                          disabled={disabled}
                        />
                      ))}
                      {!control.isRequired && answer.optionId && (
                        <button type="button" onClick={() => setAnswer(control._id, { optionId: '' })} className="text-xs text-gray-500 hover:text-gray-900 underline cursor-pointer" disabled={disabled}>
                          Clear
                        </button>
                      )}
                    </div>
                    {error && <p className="mt-1 text-sm text-red-600" role="alert">{error}</p>}
                  </fieldset>
                );
              }

              if (control.type === 'dropdown') {
                // The unit dropdown is asked only on a per unit item.
                if (unitControl && control._id === unitControl._id) return item.chargeBy === 'unit' ? renderUnit(control, error) : null;
                return (
                  <Dropdown
                    key={control._id}
                    label={control.label}
                    name={name}
                    options={control.options.map((option) => ({ value: option._id, label: option.name }))}
                    value={answer.optionId || ''}
                    onChange={(value) => setAnswer(control._id, { optionId: value || '' })}
                    placeholder={`Choose ${control.label}`}
                    clearable={!control.isRequired}
                    required={control.isRequired}
                    error={error}
                    disabled={disabled}
                    aria-label={control.label}
                  />
                );
              }

              if (control.type === 'textarea') {
                return (
                  <div key={control._id}>
                    <TextArea
                      label={control.label}
                      name={name}
                      placeholder={control.placeholder || ''}
                      value={answer.text}
                      onChange={(e) => setAnswer(control._id, { text: e.target.value })}
                      maxLength={max}
                      showCharCount={control.maxLength !== null && control.maxLength !== undefined}
                      rows={3}
                      required={control.isRequired}
                      disabled={disabled}
                    />
                    {error && <p className="mt-1 text-sm text-red-600" role="alert">{error}</p>}
                  </div>
                );
              }

              const isTaxed = control.isPrice && control.isPriceIncludedInTax && isTaxApplied;
              const symbol = currency?.symbol ? ` (${currency.symbol})` : '';
              const isRate = control.isPrice && isRateTimesQuantity;
              const charge = control.isPrice ? chargeOf(control, pricing) : { chargedBy: null, factor: 1 };
              const watchChange = isRate || (isRateTimesQuantity && control.isQuantity)
                ? { onFocus: () => { focusedText.current = answer.text; }, onBlur: (e) => checkTotals(control, e.target.value) }
                : {};
              const field = (
                <InputField
                  label={isRate ? `${pricing ? rateLabelOf(charge.chargedBy) : 'Rate'}${symbol}` : control.isPrice ? `${control.label}${symbol}` : control.label}
                  name={name}
                  placeholder={control.placeholder || (control.isPrice ? 'e.g. 150.50' : control.isQuantity ? 'e.g. 5' : '')}
                  inputMode={control.isPrice ? 'decimal' : control.isQuantity ? 'numeric' : undefined}
                  value={answer.text}
                  onChange={(e) => setAnswer(control._id, { text: e.target.value })}
                  error={error}
                  maxLength={max}
                  required={control.isRequired}
                  disabled={disabled}
                  {...watchChange}
                />
              );
              if (!isRate) {
                return (
                  <div key={control._id}>
                    {field}
                    {control.isPrice && <p className="mt-1 text-xs text-gray-500">{isTaxed ? 'Price - tax is added on it' : 'Price'}</p>}
                  </div>
                );
              }

              // Rate x quantity (x the size on a per unit item): the total shows
              // it worked out until typed over; emptying it goes back to it.
              const worked = workedTotalOf(answer.text, quantity * charge.factor);
              let workedHint = `Rate × quantity (${quantity}).`;
              if (pricing && !pricing.unit) workedHint = 'Pick the unit to work out the size.';
              else if (charge.chargedBy === 'unit') workedHint = `Rate × ${formatSize(charge.factor)} ${pricing.unit.name} × quantity (${quantity}).`;
              else if (charge.chargedBy === 'edge') workedHint = `Rate × edge ${formatSize(charge.factor)} × quantity (${quantity}).`;
              return (
                <fieldset key={control._id} className="min-w-0">
                  <legend className="mb-2 text-sm font-medium text-gray-700 break-words">
                    {control.label}{control.isRequired && <span className="text-red-500 ml-1">*</span>}
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {field}
                    <InputField
                      label={`Total${symbol}`}
                      name={`total-${item.key}-${control._id}`}
                      placeholder="Worked out"
                      inputMode="decimal"
                      value={answer.isTotalEdited ? answer.total : (worked === null ? '' : String(worked))}
                      onChange={(e) => setAnswer(control._id, e.target.value.trim() ? { total: e.target.value, isTotalEdited: true } : { total: '', isTotalEdited: false })}
                      maxLength={30}
                      disabled={disabled}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {answer.isTotalEdited ? 'Total typed by hand - empty it to go back to the worked out total.' : workedHint}
                    {isTaxed ? ' Tax is added on it.' : ''}
                  </p>
                </fieldset>
              );
            })}
          </div>
        )}

        {showImages && (
          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium text-gray-700">Images</p>
              <p className="text-xs text-gray-500">
                {imageRules?.isOn ? 'Photos of the work, e.g. the part or the drawing. Uploaded when you save.' : 'Adding images is not available for your account; you can still remove these.'}
              </p>
            </div>
            <ImageUploader
              images={item.images.map((image) => ({ key: image.key, src: image.src || image.url, name: image.name }))}
              onAdd={onAddImages}
              onRemove={onRemoveImage}
              accept={(imageRules?.formats || Object.keys(IMAGE_MIME_TYPES)).map((format) => IMAGE_MIME_TYPES[format])}
              maxSizeMB={imageRules?.maxSizeMB ?? null}
              maxCount={maxImages}
              canAdd={imageRules?.isOn === true}
              disabled={disabled}
              label={`${title} images`}
              error={errors[`${prefix}images`]}
            />
          </div>
        )}
      </div>
    </Card>
  );
};

export default JobOrderItemFields;
