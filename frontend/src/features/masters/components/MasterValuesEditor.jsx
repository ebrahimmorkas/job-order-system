import { useId, useState } from 'react';
import InputField from '../../../components/common/InputField';
import Button from '../../../components/common/Buttons';
import Switch from '../../../components/common/Switch';
import { useToast } from '../../../components/common/Toast';
import IconButton from './IconButton';
import DefaultChoice from './DefaultChoice';
import UsagePill from './UsagePill';
import { MoveUpIcon, MoveDownIcon, EditIcon, TrashIcon, PlusIcon } from './icons';
import { VALUE_NAME_MAX_LENGTH, checkValueName } from '../utils/valueName';

/**
 * The editable list of a master's values: add, rename, active / inactive,
 * default, delete and move up / down. Nothing is saved here - every change goes to
 * `onChange`, and the page saves the whole list with its Save button.
 *
 * The "add a value" text is controlled by the page (newName), so a value
 * typed but not added yet can still be saved with the master.
 *
 * @param {Object} props
 * @param {Array<{ key: string, _id?: string, name: string, status: 'A'|'I', isDefault: boolean }>} props.values - In dropdown order
 * @param {(values: Array) => void} props.onChange
 * @param {() => string} props.createKey - A new unique key for an added value
 * @param {number|null} props.valuesAllowed - The vendor's limit per master
 * @param {string} props.newName
 * @param {(name: string) => void} props.onNewNameChange
 * @param {string} [props.addError] - Error for the "add a value" box
 * @param {(error: string) => void} props.onAddError
 * @param {string} [props.error] - Error for the whole list (e.g. "Add at least one value")
 * @param {boolean} [props.disabled] - Blocks every action (e.g. while saving)
 */
const MasterValuesEditor = ({
  values, onChange, createKey, valuesAllowed,
  newName, onNewNameChange, addError = '', onAddError,
  error = '', disabled = false,
}) => {
  const toast = useToast();
  const groupId = useId();
  const [editingKey, setEditingKey] = useState(null);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState('');

  const isFull = valuesAllowed !== null && values.length >= valuesAllowed;

  const handleAdd = () => {
    const failure = checkValueName(values, newName, valuesAllowed);
    if (failure) return onAddError(failure);
    onChange([...values, { key: createKey(), name: newName.trim(), status: 'A', isDefault: false }]);
    onNewNameChange('');
  };

  const startEdit = (value) => {
    setEditingKey(value.key);
    setEditName(value.name);
    setEditError('');
  };

  const handleRename = (value) => {
    const failure = checkValueName(values, editName, valuesAllowed, value.key);
    if (failure) return setEditError(failure);
    onChange(values.map((v) => (v.key === value.key ? { ...v, name: editName.trim() } : v)));
    setEditingKey(null);
  };

  const toggle = (value) => {
    const status = value.status === 'A' ? 'I' : 'A';
    // An inactive value can't stay the default.
    onChange(values.map((v) => (v.key === value.key ? { ...v, status, isDefault: status === 'A' && v.isDefault } : v)));
    const wasDefault = status === 'I' && value.isDefault ? ' It is no longer the default.' : '';
    toast.info(`"${value.name}" marked as ${status === 'A' ? 'active' : 'inactive'}.${wasDefault} Save to keep this change.`);
  };

  const toggleDefault = (value) => {
    const isDefault = !value.isDefault;
    onChange(values.map((v) => ({ ...v, isDefault: v.key === value.key ? isDefault : false })));
    toast.info(isDefault ? `"${value.name}" is now the default. Save to keep this change.` : 'No default value. Save to keep this change.');
  };

  const remove = (value) => onChange(values.filter((v) => v.key !== value.key));

  const move = (index, direction) => {
    const next = [...values];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    onChange(next);
  };

  // Enter in these boxes adds / renames instead of submitting the page's form.
  const onEnter = (action) => (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      action();
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-2">
        {valuesAllowed !== null && (
          <UsagePill used={values.length} allowed={valuesAllowed} label="values" title={`A master can have at most ${valuesAllowed} values`} />
        )}
      </div>

      {values.length > 0 && (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {values.map((value, index) => {
            const isEditing = editingKey === value.key;
            const isActive = value.status === 'A';
            return (
              <li key={value.key} className="flex items-center gap-2 px-2 py-2 sm:px-3">
                <div className="flex shrink-0">
                  <IconButton label={`Move "${value.name}" up`} icon={MoveUpIcon} size="sm" onClick={() => move(index, -1)} disabled={disabled || index === 0} />
                  <IconButton label={`Move "${value.name}" down`} icon={MoveDownIcon} size="sm" onClick={() => move(index, 1)} disabled={disabled || index === values.length - 1} />
                </div>

                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="flex items-start gap-2">
                      <InputField
                        name={`value-${value.key}`}
                        aria-label="Value name"
                        value={editName}
                        onChange={(e) => { setEditName(e.target.value); setEditError(''); }}
                        onKeyDown={onEnter(() => handleRename(value))}
                        error={editError}
                        maxLength={VALUE_NAME_MAX_LENGTH}
                        autoFocus
                      />
                      <Button size="sm" className="mt-0.5" onClick={() => handleRename(value)}>OK</Button>
                      <Button size="sm" variant="ghost" className="mt-0.5" onClick={() => setEditingKey(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <p className={`text-sm break-words ${isActive ? 'text-gray-900' : 'text-gray-400 line-through decoration-gray-300'}`}>
                      {value.name}
                    </p>
                  )}
                </div>

                {!isEditing && (
                  <div className="flex items-center gap-1 shrink-0">
                    <DefaultChoice
                      name={`default-${groupId}`}
                      valueName={value.name}
                      checked={value.isDefault}
                      isActive={isActive}
                      onToggle={() => toggleDefault(value)}
                      disabled={disabled}
                    />
                    <Switch
                      size="sm"
                      checked={isActive}
                      onChange={() => toggle(value)}
                      disabled={disabled}
                      aria-label={`"${value.name}" ${isActive ? 'is active' : 'is inactive'}`}
                    />
                    <span className="hidden sm:inline w-14 text-xs text-gray-500">{isActive ? 'Active' : 'Inactive'}</span>
                    <IconButton label={`Rename "${value.name}"`} icon={EditIcon} onClick={() => startEdit(value)} disabled={disabled} />
                    <IconButton label={`Remove "${value.name}"`} icon={TrashIcon} variant="danger" onClick={() => remove(value)} disabled={disabled} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>}

      <div className="mt-3 flex items-start gap-2">
        <InputField
          name="newValue"
          aria-label="New value"
          placeholder={isFull ? 'The limit for values is reached' : 'Add a value, e.g. Polishing'}
          value={newName}
          onChange={(e) => { onNewNameChange(e.target.value); if (addError) onAddError(''); }}
          onKeyDown={onEnter(handleAdd)}
          error={addError}
          maxLength={VALUE_NAME_MAX_LENGTH}
          disabled={disabled || isFull}
        />
        <Button variant="outline" onClick={handleAdd} disabled={disabled || isFull} leftIcon={<PlusIcon className="w-4 h-4" />} className="shrink-0 !py-[7px]">
          Add
        </Button>
      </div>
    </div>
  );
};

export default MasterValuesEditor;
