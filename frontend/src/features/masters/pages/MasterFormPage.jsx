import { useEffect, useMemo, useRef, useState } from 'react';
import InputField from '../../../components/common/InputField';
import Button from '../../../components/common/Buttons';
import Checkbox from '../../../components/common/Checkbox';
import Card from '../../../components/common/Card';
import Alert from '../../../components/common/Alert';
import Badge from '../../../components/common/Badge';
import Spinner from '../../../components/common/Spinner';
import { useUnsavedChanges } from '../../../components/common/UnsavedChanges';
import MasterValuesEditor from '../components/MasterValuesEditor';
import { checkValueName } from '../utils/valueName';
import { BackIcon } from '../components/icons';
import * as mastersApi from '../api/mastersApi';

// Same limits as the backend (constants/masterConstants.js).
const NAME_MAX_LENGTH = 50;
const SHORT_NAME_MAX_LENGTH = 10;
const COPY_SUFFIX = ' (Copy)';

const EMPTY_DETAILS = { name: '', shortName: '', isMultiselectAllowed: false };

const toDetails = (master) => ({
  name: master.name,
  shortName: master.shortName || '',
  isMultiselectAllowed: master.isMultiselectAllowed,
});

// What gets saved, as one string - compared with the loaded one to know
// whether anything changed.
const toSnapshot = (details, values) =>
  JSON.stringify([details, values.map(({ _id, name, status }) => [_id, name, status])]);

// The server's field errors ({ field, message }) by field name. Errors on a
// single value ("values.2.name") count as errors of the values list.
const toFieldErrors = (errors) => {
  const fieldErrors = {};
  for (const { field, message } of errors || []) {
    const key = field.startsWith('values') ? 'values' : field;
    if (!fieldErrors[key]) fieldErrors[key] = message;
  }
  return fieldErrors;
};

/**
 * Create a master, save a copy of one, or edit one. Everything - the details
 * and every value change - is kept on the page until Create / Save; leaving
 * with unsaved changes asks first.
 *
 * @param {Object} props
 * @param {'create'|'clone'|'edit'} props.mode
 * @param {string} [props.masterId] - The master to edit, or to copy (clone)
 * @param {number|null} [props.valuesAllowed] - The vendor's limit, known from the list (create)
 * @param {(message: string) => void} props.onDone - Back to the list after saving
 * @param {() => void} props.onBack
 */
const MasterFormPage = ({ mode, masterId, valuesAllowed: knownValuesAllowed = null, onDone, onBack }) => {
  const isEdit = mode === 'edit';
  const nextKey = useRef(0);
  const createKey = () => `new-${nextKey.current++}`;

  const [isLoading, setIsLoading] = useState(mode !== 'create');
  const [loadError, setLoadError] = useState('');
  const [details, setDetails] = useState(EMPTY_DETAILS);
  const [values, setValues] = useState([]);
  const [savedSnapshot, setSavedSnapshot] = useState(() => toSnapshot(EMPTY_DETAILS, []));
  const [valuesAllowed, setValuesAllowed] = useState(knownValuesAllowed);
  const [status, setStatus] = useState('A');
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (mode === 'create') return undefined;
    let cancelled = false;
    mastersApi
      .getMaster(masterId)
      .then(({ master, limits }) => {
        if (cancelled) return;
        setValuesAllowed(limits.valuesAllowedPerMaster);
        setStatus(master.status);
        let loadedDetails;
        let loadedValues;
        if (mode === 'edit') {
          loadedDetails = toDetails(master);
          loadedValues = master.values.map(({ _id, name, status: valueStatus }) => ({ key: _id, _id, name, status: valueStatus }));
        } else {
          // Clone: a new master with the same settings and values. The short
          // name is left empty - it must be unique.
          const base = master.name.slice(0, NAME_MAX_LENGTH - COPY_SUFFIX.length);
          loadedDetails = { ...toDetails(master), name: `${base}${COPY_SUFFIX}`, shortName: '' };
          loadedValues = master.values.map(({ name, status: valueStatus }) => ({ key: `new-${nextKey.current++}`, name, status: valueStatus }));
        }
        setDetails(loadedDetails);
        setValues(loadedValues);
        setSavedSnapshot(toSnapshot(loadedDetails, loadedValues));
      })
      .catch((err) => !cancelled && setLoadError(err.message))
      .finally(() => !cancelled && setIsLoading(false));
    return () => { cancelled = true; };
  }, [mode, masterId]);

  const isDirty = useMemo(
    () => !isLoading && !loadError && (newName.trim() !== '' || toSnapshot(details, values) !== savedSnapshot),
    [isLoading, loadError, newName, details, values, savedSnapshot],
  );
  const confirmLeave = useUnsavedChanges(isDirty && !isSaving);

  const setDetail = (field, value) => {
    setDetails((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: '' }));
    if (formError) setFormError('');
  };

  const handleValuesChange = (next) => {
    setValues(next);
    if (fieldErrors.values) setFieldErrors((prev) => ({ ...prev, values: '' }));
    if (formError) setFormError('');
  };

  // The values to save, including one typed but not added yet;
  // null when that typed value can't be added (its error is shown).
  const collectValues = () => {
    if (!newName.trim()) return values;
    const failure = checkValueName(values, newName, valuesAllowed);
    if (failure) {
      setAddError(failure);
      return null;
    }
    const next = [...values, { key: createKey(), name: newName.trim(), status: 'A' }];
    setValues(next);
    setNewName('');
    return next;
  };

  const validate = (valuesToSave) => {
    const errors = {};
    const name = details.name.trim();
    if (!name) errors.name = 'Enter a name';
    else if (name.length < 2) errors.name = 'The name must be at least 2 characters';
    if (valuesToSave.length === 0) errors.values = 'Add at least one value';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    const valuesToSave = collectValues();
    if (!valuesToSave || !validate(valuesToSave)) return;
    const payload = {
      name: details.name.trim(),
      shortName: details.shortName.trim() || null,
      isMultiselectAllowed: details.isMultiselectAllowed,
      values: valuesToSave.map(({ _id, name, status: valueStatus }) => (_id ? { _id, name, status: valueStatus } : { name, status: valueStatus })),
    };
    setIsSaving(true);
    setFormError('');
    try {
      if (isEdit) {
        await mastersApi.updateMaster(masterId, payload);
        onDone('Master saved.');
      } else {
        await mastersApi.createMaster(payload);
        onDone(mode === 'clone' ? 'Copy of the master created.' : 'Master created.');
      }
    } catch (err) {
      const errors = toFieldErrors(err.errors);
      setFieldErrors(errors);
      // A message not tied to one field (e.g. the masters limit) goes on top.
      if (!errors.name && !errors.shortName && !errors.values) setFormError(err.message);
      setIsSaving(false);
    }
  };

  const goBack = () => confirmLeave(onBack);

  const title = { create: 'New master', clone: 'Copy master', edit: 'Edit master' }[mode];
  const submitLabel = { create: 'Create master', clone: 'Create copy', edit: 'Save changes' }[mode];

  if (isLoading) return <div className="py-24 flex justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <button type="button" onClick={goBack} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 cursor-pointer">
          <BackIcon className="w-4 h-4" /> Back to masters
        </button>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {isEdit && <Badge variant={status === 'A' ? 'green' : 'gray'} dot>{status === 'A' ? 'Active' : 'Inactive'}</Badge>}
        </div>
        {mode === 'clone' && <p className="mt-1 text-sm text-gray-500">Change anything you need, then create the copy.</p>}
      </div>

      {loadError ? (
        <Alert variant="error">{loadError}</Alert>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {formError && <Alert variant="error">{formError}</Alert>}

          <Card variant="outlined" title="Details">
            <div className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <InputField
                    label="Name"
                    name="name"
                    placeholder="e.g. My Services"
                    value={details.name}
                    onChange={(e) => setDetail('name', e.target.value)}
                    error={fieldErrors.name}
                    maxLength={NAME_MAX_LENGTH}
                    required
                    disabled={isSaving}
                    autoFocus={!isEdit}
                  />
                </div>
                <InputField
                  label="Short name"
                  name="shortName"
                  placeholder="e.g. SVC"
                  value={details.shortName}
                  onChange={(e) => setDetail('shortName', e.target.value)}
                  error={fieldErrors.shortName}
                  maxLength={SHORT_NAME_MAX_LENGTH}
                  disabled={isSaving}
                />
              </div>
              <Checkbox
                name="isMultiselectAllowed"
                label="Allow multiple selection"
                description="On the job order, more than one value can be picked from this list."
                checked={details.isMultiselectAllowed}
                onChange={(e) => setDetail('isMultiselectAllowed', e.target.checked)}
                disabled={isSaving}
              />
            </div>
          </Card>

          <Card variant="outlined" title="Values" subtitle="The options of this dropdown, in the order shown.">
            <MasterValuesEditor
              values={values}
              onChange={handleValuesChange}
              createKey={createKey}
              valuesAllowed={valuesAllowed}
              newName={newName}
              onNewNameChange={setNewName}
              addError={addError}
              onAddError={setAddError}
              error={fieldErrors.values}
              disabled={isSaving}
            />
          </Card>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={goBack} disabled={isSaving}>Cancel</Button>
            <Button type="submit" loading={isSaving} loadingText={isEdit ? 'Saving...' : 'Creating...'}>{submitLabel}</Button>
          </div>
        </form>
      )}
    </div>
  );
};

export default MasterFormPage;
