import { useId, useState } from 'react';
import InputField from '../InputField';
import Button from '../Buttons';
import Switch from '../Switch';
import IconButton from '../IconButton';
import DefaultChoice from '../DefaultChoice';
import UsagePill from '../UsagePill';
import { useToast } from '../Toast';
import { MoveUpIcon, MoveDownIcon, EditIcon, TrashIcon, PlusIcon } from '../ActionIcons';
import { checkItemName } from './checkItemName';

/**
 * An editable, ordered list of named items (a master's values, a radio
 * group's choices): add, rename, default, move up / down, remove and -
 * with `hasStatus` - active / inactive. Nothing is saved here: every change
 * goes to `onChange`, and the page saves the whole list with its Save button.
 *
 * The "add" text is controlled by the page (newName), so an item typed but
 * not added yet can still be saved with the rest.
 *
 * @param {Object} props
 * @param {Array<{ key: string, _id?: string, name: string, status?: 'A'|'I', isDefault: boolean }>} props.items - In order
 * @param {(items: Array) => void} props.onChange
 * @param {() => string} props.createKey - A new unique key for an added item
 * @param {number|null} props.itemsAllowed - null = no limit
 * @param {number|null} [props.maxLength] - Longest item name, null = no limit
 * @param {{ singular: string, plural: string, owner: string }} props.noun - e.g. value / values / master
 * @param {boolean} [props.hasStatus] - Items can be active / inactive
 * @param {string} [props.addPlaceholder]
 * @param {string} props.newName
 * @param {(name: string) => void} props.onNewNameChange
 * @param {string} [props.addError] - Error for the "add" box
 * @param {(error: string) => void} props.onAddError
 * @param {string} [props.error] - Error for the whole list (e.g. "Add at least one value")
 * @param {boolean} [props.disabled] - Blocks every action (e.g. while saving)
 */
const ListItemsEditor = ({
  items, onChange, createKey, itemsAllowed, maxLength = null, noun, hasStatus = true, addPlaceholder = '',
  newName, onNewNameChange, addError = '', onAddError,
  error = '', disabled = false,
}) => {
  const toast = useToast();
  const groupId = useId();
  const [editingKey, setEditingKey] = useState(null);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState('');

  const rules = { itemsAllowed, maxLength, noun };
  const isFull = itemsAllowed !== null && items.length >= itemsAllowed;
  const inputMaxLength = maxLength ?? undefined;

  const handleAdd = () => {
    const failure = checkItemName(items, newName, rules);
    if (failure) return onAddError(failure);
    onChange([...items, { key: createKey(), name: newName.trim(), ...(hasStatus && { status: 'A' }), isDefault: false }]);
    onNewNameChange('');
  };

  const startEdit = (item) => {
    setEditingKey(item.key);
    setEditName(item.name);
    setEditError('');
  };

  const handleRename = (item) => {
    const failure = checkItemName(items, editName, rules, item.key);
    if (failure) return setEditError(failure);
    onChange(items.map((i) => (i.key === item.key ? { ...i, name: editName.trim() } : i)));
    setEditingKey(null);
  };

  const toggle = (item) => {
    const status = item.status === 'A' ? 'I' : 'A';
    // An inactive item can't stay the default.
    onChange(items.map((i) => (i.key === item.key ? { ...i, status, isDefault: status === 'A' && i.isDefault } : i)));
    const wasDefault = status === 'I' && item.isDefault ? ' It is no longer the default.' : '';
    toast.info(`"${item.name}" marked as ${status === 'A' ? 'active' : 'inactive'}.${wasDefault} Save to keep this change.`);
  };

  const toggleDefault = (item) => {
    const isDefault = !item.isDefault;
    onChange(items.map((i) => ({ ...i, isDefault: i.key === item.key ? isDefault : false })));
    toast.info(isDefault ? `"${item.name}" is now the default. Save to keep this change.` : `No default ${noun.singular}. Save to keep this change.`);
  };

  const remove = (item) => onChange(items.filter((i) => i.key !== item.key));

  const move = (index, direction) => {
    const next = [...items];
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
        {itemsAllowed !== null && (
          <UsagePill used={items.length} allowed={itemsAllowed} label={noun.plural} title={`A ${noun.owner} can have at most ${itemsAllowed} ${noun.plural}`} />
        )}
      </div>

      {items.length > 0 && (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {items.map((item, index) => {
            const isEditing = editingKey === item.key;
            const isActive = !hasStatus || item.status === 'A';
            return (
              <li key={item.key} className="flex items-center gap-2 px-2 py-2 sm:px-3">
                <div className="flex shrink-0">
                  <IconButton label={`Move "${item.name}" up`} icon={MoveUpIcon} size="sm" onClick={() => move(index, -1)} disabled={disabled || index === 0} />
                  <IconButton label={`Move "${item.name}" down`} icon={MoveDownIcon} size="sm" onClick={() => move(index, 1)} disabled={disabled || index === items.length - 1} />
                </div>

                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="flex items-start gap-2">
                      <InputField
                        name={`item-${item.key}`}
                        aria-label={`${noun.singular.charAt(0).toUpperCase()}${noun.singular.slice(1)} name`}
                        value={editName}
                        onChange={(e) => { setEditName(e.target.value); setEditError(''); }}
                        onKeyDown={onEnter(() => handleRename(item))}
                        error={editError}
                        maxLength={inputMaxLength}
                        autoFocus
                      />
                      <Button size="sm" className="mt-0.5" onClick={() => handleRename(item)}>OK</Button>
                      <Button size="sm" variant="ghost" className="mt-0.5" onClick={() => setEditingKey(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <p className={`text-sm break-words ${isActive ? 'text-gray-900' : 'text-gray-400 line-through decoration-gray-300'}`}>
                      {item.name}
                    </p>
                  )}
                </div>

                {!isEditing && (
                  <div className="flex items-center gap-1 shrink-0">
                    <DefaultChoice
                      name={`default-${groupId}`}
                      valueName={item.name}
                      checked={item.isDefault}
                      isActive={isActive}
                      onToggle={() => toggleDefault(item)}
                      disabled={disabled}
                    />
                    {hasStatus && (
                      <>
                        <Switch
                          size="sm"
                          checked={isActive}
                          onChange={() => toggle(item)}
                          disabled={disabled}
                          aria-label={`"${item.name}" ${isActive ? 'is active' : 'is inactive'}`}
                        />
                        <span className="hidden sm:inline w-14 text-xs text-gray-500">{isActive ? 'Active' : 'Inactive'}</span>
                      </>
                    )}
                    <IconButton label={`Rename "${item.name}"`} icon={EditIcon} onClick={() => startEdit(item)} disabled={disabled} />
                    <IconButton label={`Remove "${item.name}"`} icon={TrashIcon} variant="danger" onClick={() => remove(item)} disabled={disabled} />
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
          name="newItem"
          aria-label={`New ${noun.singular}`}
          placeholder={isFull ? `The limit for ${noun.plural} is reached` : addPlaceholder}
          value={newName}
          onChange={(e) => { onNewNameChange(e.target.value); if (addError) onAddError(''); }}
          onKeyDown={onEnter(handleAdd)}
          error={addError}
          maxLength={inputMaxLength}
          disabled={disabled || isFull}
        />
        <Button variant="outline" onClick={handleAdd} disabled={disabled || isFull} leftIcon={<PlusIcon className="w-4 h-4" />} className="shrink-0 !py-[7px]">
          Add
        </Button>
      </div>
    </div>
  );
};

export default ListItemsEditor;
