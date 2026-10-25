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
import { JOB_NAME_MAX_LENGTH } from '../jobOrderItems';

// Same as the backend (constants/jobOrderConstants.js).
const ANSWER_MAX_LENGTH = 5000;
const DEFAULT_UNIT = 'days';

// The backend's format names (CompanyMaster.imageFormatsAllowed) and their types.
const IMAGE_MIME_TYPES = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

/**
 * One item of the job order form: its job name ("Same as above" from the
 * second item copies the name of the item above, still editable), every
 * master (with who does each picked value of a role master, and by when),
 * every control and its images.
 *
 * @param {Object} props
 * @param {Object} props.item - { key, itemId, name, sameAsAbove, picks, answers, images, assign, completeIn }
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
 * @param {boolean} props.disabled
 */
const JobOrderItemFields = ({
  item, title, prefix, parts, errors, onChange, onSameAsAbove, onRemove, peopleOptionsOf,
  imageRules, maxImages, onAddImages, onRemoveImage, currency, isTaxApplied, disabled,
}) => {
  const { settings } = parts;
  const showImages = imageRules?.isOn || item.images.length > 0;

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
              return (
                <div key={control._id}>
                  <InputField
                    label={control.isPrice && currency?.symbol ? `${control.label} (${currency.symbol})` : control.label}
                    name={name}
                    placeholder={control.placeholder || (control.isPrice ? 'e.g. 150.50' : '')}
                    inputMode={control.isPrice ? 'decimal' : undefined}
                    value={answer.text}
                    onChange={(e) => setAnswer(control._id, { text: e.target.value })}
                    error={error}
                    maxLength={max}
                    required={control.isRequired}
                    disabled={disabled}
                  />
                  {control.isPrice && <p className="mt-1 text-xs text-gray-500">{isTaxed ? 'Price - tax is added on it' : 'Price'}</p>}
                </div>
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
