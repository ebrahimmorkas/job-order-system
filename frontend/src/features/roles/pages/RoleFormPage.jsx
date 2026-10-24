import { useEffect, useMemo, useState } from 'react';
import InputField from '../../../components/common/InputField';
import Button from '../../../components/common/Buttons';
import Checkbox from '../../../components/common/Checkbox';
import Card from '../../../components/common/Card';
import Alert from '../../../components/common/Alert';
import Badge from '../../../components/common/Badge';
import Spinner from '../../../components/common/Spinner';
import Dropdown from '../../../components/common/DropDown';
import IconButton from '../../../components/common/IconButton';
import { useUnsavedChanges } from '../../../components/common/UnsavedChanges';
import { BackIcon, TrashIcon } from '../../../components/common/ActionIcons';
import { ROLE_TYPES, PERMISSIONS, MODULE_LABELS } from '../roleTypes';
import * as rolesApi from '../api/rolesApi';

// Same limits as the backend (constants/rbacConstants.js).
const NAME_MAX_LENGTH = 50;
const COPY_SUFFIX = ' (Copy)';

const EMPTY_ROLE = { name: '', type: 'module', modules: [], masters: [] };

// What gets saved, as one string - compared with the loaded one to know
// whether anything changed.
const toSnapshot = (role) => JSON.stringify([role.name.trim(), role.type, role.modules, role.masters]);

// The server's field errors ({ field, message }) by field name: name,
// modules, masters, modules.<key>, masters.<masterId>. Anything deeper
// ("masters.0.valueIds") counts as an error of its list.
const toFieldErrors = (errors) => {
  const fieldErrors = {};
  for (const { field, message } of errors || []) {
    const [list, item] = field.split('.');
    const key = item && !/^\d+$/.test(item) ? `${list}.${item}` : list;
    if (!fieldErrors[key]) fieldErrors[key] = message;
  }
  return fieldErrors;
};

// What comes with a permission (same as the backend's IMPLIED_PERMISSIONS):
// Edit gives Details - you can't edit what you can't open.
const IMPLIED = { edit: ['details'] };

// Giving anything also gives view (and Edit gives Details); taking view away
// takes everything away, and taking Details away takes Edit with it.
// allowed: the module's own permissions (Company Settings has no Details).
const togglePermission = (permissions, permission, isOn, allowed) => {
  if (!isOn) {
    if (permission === 'view') return [];
    const needing = Object.keys(IMPLIED).filter((key) => IMPLIED[key].includes(permission));
    return permissions.filter((p) => p !== permission && !needing.includes(p));
  }
  const next = new Set([...permissions, permission, 'view', ...(IMPLIED[permission] || [])]);
  return PERMISSIONS.map((p) => p.key).filter((p) => next.has(p) && allowed.includes(p));
};

/**
 * Create a role, save a copy of one, or edit one. A module role gives
 * view (the list) / details (open one, read only) / create / edit / delete
 * per module; a master role gives view of
 * whole masters or some of their values. The type is picked when the role
 * is created and can't change.
 *
 * @param {Object} props
 * @param {'create'|'clone'|'edit'} props.mode
 * @param {string} [props.roleId] - The role to edit, or to copy (clone)
 * @param {(message: string) => void} props.onDone - Back to the list after saving
 * @param {() => void} props.onBack
 * @param {boolean} [props.readOnly] - Details only (mode 'edit', nothing can be changed)
 * @param {(() => void)|null} [props.onEdit] - Details: opens the edit screen (with Edit permission)
 */
const RoleFormPage = ({ mode, roleId, onDone, onBack, readOnly = false, onEdit = null }) => {
  const isEdit = mode === 'edit';

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // { modules: [{ key, label, permissions }], masters: [{ _id, name, values }] }
  const [options, setOptions] = useState({ modules: [], masters: [] });
  const [role, setRole] = useState(EMPTY_ROLE);
  const [savedSnapshot, setSavedSnapshot] = useState(() => toSnapshot(EMPTY_ROLE));
  const [status, setStatus] = useState('A');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  // Saving, or details only: every field is off.
  const isLocked = isSaving || readOnly;

  useEffect(() => {
    let cancelled = false;
    Promise.all([rolesApi.getFormData(), mode === 'create' ? null : rolesApi.getRole(roleId)])
      .then(([formData, loaded]) => {
        if (cancelled) return;
        setOptions({ modules: formData.modules, masters: formData.masters });
        if (!loaded) return;
        const { role: saved } = loaded;
        setStatus(saved.status);
        const base = saved.name.slice(0, NAME_MAX_LENGTH - COPY_SUFFIX.length);
        const loadedRole = {
          name: mode === 'edit' ? saved.name : `${base}${COPY_SUFFIX}`,
          type: saved.type,
          modules: saved.modules.map(({ module, permissions }) => ({ module, permissions })),
          masters: saved.masters.map(({ masterId, isWholeMaster, valueIds }) => ({ masterId, isWholeMaster, valueIds })),
        };
        setRole(loadedRole);
        // A copy is new: it counts as changed until created.
        if (mode === 'edit') setSavedSnapshot(toSnapshot(loadedRole));
      })
      .catch((err) => !cancelled && setLoadError(err.message))
      .finally(() => !cancelled && setIsLoading(false));
    return () => { cancelled = true; };
  }, [mode, roleId]);

  const isDirty = useMemo(() => !isLoading && !loadError && toSnapshot(role) !== savedSnapshot, [isLoading, loadError, role, savedSnapshot]);
  const confirmLeave = useUnsavedChanges(isDirty && !isSaving);

  const moduleByKey = useMemo(() => new Map(options.modules.map((m) => [m.key, m])), [options.modules]);
  const masterById = useMemo(() => new Map(options.masters.map((m) => [m._id, m])), [options.masters]);

  const clearErrors = (...keys) => {
    if (keys.some((key) => fieldErrors[key])) setFieldErrors((prev) => ({ ...prev, ...Object.fromEntries(keys.map((key) => [key, ''])) }));
    if (formError) setFormError('');
  };

  const update = (changes, ...errorKeys) => {
    setRole((prev) => ({ ...prev, ...changes }));
    clearErrors(...errorKeys);
  };

  // ---- module role ----
  const addModule = (key) => key && update({ modules: [...role.modules, { module: key, permissions: ['view'] }] }, 'modules');
  const removeModule = (key) => update({ modules: role.modules.filter((m) => m.module !== key) }, `modules.${key}`);
  const setPermission = (key, permission, isOn) =>
    update({ modules: role.modules.map((m) => (m.module === key ? { ...m, permissions: togglePermission(m.permissions, permission, isOn, moduleByKey.get(key)?.permissions || []) } : m)) }, `modules.${key}`);

  // ---- master role ----
  const addMaster = (id) => id && update({ masters: [...role.masters, { masterId: id, isWholeMaster: false, valueIds: [] }] }, 'masters');
  const removeMaster = (id) => update({ masters: role.masters.filter((m) => m.masterId !== id) }, `masters.${id}`);
  const setMaster = (id, changes) =>
    update({ masters: role.masters.map((m) => (m.masterId === id ? { ...m, ...changes } : m)) }, `masters.${id}`, 'masters');

  const validate = () => {
    const errors = {};
    const name = role.name.trim();
    if (!name) errors.name = 'Enter a name';
    else if (name.length < 2) errors.name = 'The name must be at least 2 characters';
    if (role.type === 'module') {
      if (role.modules.length === 0) errors.modules = 'Add at least one module';
      for (const m of role.modules) if (m.permissions.length === 0) errors[`modules.${m.module}`] = 'Tick at least one option';
    } else {
      if (role.masters.length === 0) errors.masters = 'Add at least one master';
      for (const m of role.masters) {
        if (!m.isWholeMaster && m.valueIds.length === 0) errors[`masters.${m.masterId}`] = 'Pick at least one value, or tick "Whole master"';
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving || !validate()) return;
    const payload = { name: role.name.trim() };
    if (role.type === 'module') payload.modules = role.modules;
    else payload.masters = role.masters.map((m) => ({ ...m, valueIds: m.isWholeMaster ? [] : m.valueIds }));
    setIsSaving(true);
    setFormError('');
    try {
      if (isEdit) {
        await rolesApi.updateRole(roleId, payload);
        onDone('Role saved.');
      } else {
        await rolesApi.createRole({ ...payload, type: role.type });
        onDone(mode === 'clone' ? 'Copy of the role created.' : 'Role created.');
      }
    } catch (err) {
      const errors = toFieldErrors(err.errors);
      setFieldErrors(errors);
      // A message not tied to a field shown here (e.g. the roles limit) goes on top.
      if (Object.keys(errors).length === 0 || errors.type) setFormError(err.message);
      setIsSaving(false);
    }
  };

  const goBack = () => confirmLeave(onBack);

  const title = { create: 'New role', clone: 'Copy role', edit: 'Edit role' }[mode];
  const submitLabel = { create: 'Create role', clone: 'Create copy', edit: 'Save changes' }[mode];

  if (isLoading) return <div className="py-24 flex justify-center"><Spinner size="lg" /></div>;

  const moduleOptions = options.modules
    .filter((m) => !role.modules.some((added) => added.module === m.key))
    .map((m) => ({ value: m.key, label: m.label }));
  const masterOptions = options.masters
    .filter((m) => !role.masters.some((added) => added.masterId === m._id))
    .map((m) => ({ value: m._id, label: m.name }));

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <button type="button" onClick={goBack} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 cursor-pointer">
          <BackIcon className="w-4 h-4" /> Back to roles
        </button>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{readOnly ? 'Role details' : title}</h1>
          {isEdit && <Badge variant={role.type === 'module' ? 'blue' : 'purple'}>{ROLE_TYPES[role.type].label}</Badge>}
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

          <Card variant="outlined" title="Details">
            <div className="space-y-5">
              <InputField
                label="Role name"
                name="name"
                placeholder="e.g. Office staff"
                value={role.name}
                onChange={(e) => update({ name: e.target.value }, 'name')}
                error={fieldErrors.name}
                maxLength={NAME_MAX_LENGTH}
                required
                disabled={isLocked}
                autoFocus={!isEdit}
              />
              {!isEdit && (
                <div>
                  <p className="text-sm font-medium text-gray-700">Role type</p>
                  <p className="mt-0.5 text-xs text-gray-500">A role is one kind or the other. It can't be changed later.</p>
                  <div role="radiogroup" aria-label="Role type" className="mt-2 grid gap-3 sm:grid-cols-2">
                    {Object.entries(ROLE_TYPES).map(([key, { label, description }]) => {
                      const isChosen = role.type === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          role="radio"
                          aria-checked={isChosen}
                          disabled={isLocked}
                          onClick={() => update({ type: key }, 'modules', 'masters')}
                          className={`text-left rounded-lg border p-3 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${isChosen ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                        >
                          <span className="block text-sm font-semibold text-gray-900">{label}</span>
                          <span className="block mt-0.5 text-xs text-gray-500">{description}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {role.type === 'module' ? (
            <Card variant="outlined" title="Modules" subtitle="Add the modules this role can use and tick what it can do in each. Ticking anything also ticks View.">
              <div className="space-y-4">
                <div className="sm:w-80">
                  <Dropdown
                    name="addModule"
                    options={moduleOptions}
                    value=""
                    onChange={addModule}
                    placeholder={moduleOptions.length ? 'Add a module' : 'Every module is added'}
                    searchable
                    disabled={isLocked || moduleOptions.length === 0}
                    aria-label="Add a module"
                  />
                </div>

                {role.modules.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                        <tr>
                          <th scope="col" className="px-4 py-2.5 text-left">Module</th>
                          {PERMISSIONS.map((p) => <th key={p.key} scope="col" className="px-3 py-2.5 text-center whitespace-nowrap">{p.label}</th>)}
                          <th scope="col" className="px-2 py-2.5"><span className="sr-only">Remove</span></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {role.modules.map(({ module, permissions }) => {
                          const available = moduleByKey.get(module);
                          const label = available?.label || MODULE_LABELS[module] || module;
                          const error = fieldErrors[`modules.${module}`];
                          return (
                            <tr key={module} className={error ? 'bg-red-50/50' : undefined}>
                              <td className="px-4 py-2.5 align-top">
                                <span className="font-medium text-gray-900">{label}</span>
                                {!available && <span className="block text-xs text-amber-700">No longer available - remove it</span>}
                                {error && <span className="block text-xs text-red-600" role="alert">{error}</span>}
                              </td>
                              {PERMISSIONS.map((p) => (
                                <td key={p.key} className="px-3 py-2.5 text-center align-top">
                                  {available?.permissions.includes(p.key) ? (
                                    <span className="inline-flex justify-center">
                                      <Checkbox
                                        name={`${module}-${p.key}`}
                                        checked={permissions.includes(p.key)}
                                        onChange={(e) => setPermission(module, p.key, e.target.checked)}
                                        disabled={isLocked}
                                        aria-label={`${label}: ${p.label}`}
                                      />
                                    </span>
                                  ) : (
                                    <span className="text-gray-300" aria-hidden="true">—</span>
                                  )}
                                </td>
                              ))}
                              <td className="px-2 py-1.5 text-right align-top">
                                <IconButton label={`Remove ${label}`} icon={TrashIcon} variant="danger" size="sm" onClick={() => removeModule(module)} disabled={isLocked} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {fieldErrors.modules && <p className="text-sm text-red-600" role="alert">{fieldErrors.modules}</p>}
              </div>
            </Card>
          ) : (
            <Card variant="outlined" title="Masters" subtitle="This role can only view what is given here: a whole master, or some of its values.">
              <div className="space-y-4">
                {options.masters.length === 0 && role.masters.length === 0 ? (
                  <Alert variant="info">
                    No master is set for roles yet. In Masters, edit a master and tick “Role will be provided for this master”.
                  </Alert>
                ) : (
                  <div className="sm:w-80">
                    <Dropdown
                      name="addMaster"
                      options={masterOptions}
                      value=""
                      onChange={addMaster}
                      placeholder={masterOptions.length ? 'Add a master' : 'Every master is added'}
                      searchable
                      disabled={isLocked || masterOptions.length === 0}
                      aria-label="Add a master"
                    />
                  </div>
                )}

                {role.masters.map(({ masterId, isWholeMaster, valueIds }) => {
                  const master = masterById.get(masterId);
                  const name = master?.name || 'Master';
                  const error = fieldErrors[`masters.${masterId}`];
                  const valueOptions = (master?.values || []).map((v) => ({ value: v._id, label: v.status === 'A' ? v.name : `${v.name} (inactive)` }));
                  return (
                    <div key={masterId} className={`rounded-lg border p-4 ${error ? 'border-red-300 bg-red-50/40' : 'border-gray-200'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-gray-900">{name}</p>
                          {!master && <p className="text-xs text-amber-700">No longer set for roles - remove it</p>}
                        </div>
                        <IconButton label={`Remove ${name}`} icon={TrashIcon} variant="danger" size="sm" onClick={() => removeMaster(masterId)} disabled={isLocked} />
                      </div>
                      {master && (
                        <div className="mt-3 space-y-3">
                          <Checkbox
                            name={`whole-${masterId}`}
                            label="Whole master"
                            description="Every value, including ones added later."
                            checked={isWholeMaster}
                            onChange={(e) => setMaster(masterId, { isWholeMaster: e.target.checked })}
                            disabled={isLocked}
                          />
                          {!isWholeMaster && (
                            <Dropdown
                              label="Values"
                              name={`values-${masterId}`}
                              options={valueOptions}
                              multiple
                              value={valueIds}
                              onChange={(value) => setMaster(masterId, { valueIds: value })}
                              placeholder="Choose one or more"
                              searchable
                              disabled={isLocked}
                              aria-label={`Values of ${name}`}
                            />
                          )}
                        </div>
                      )}
                      {error && <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>}
                    </div>
                  );
                })}
                {fieldErrors.masters && <p className="text-sm text-red-600" role="alert">{fieldErrors.masters}</p>}
              </div>
            </Card>
          )}

          {!readOnly && (
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={goBack} disabled={isSaving}>Cancel</Button>
            <Button type="submit" loading={isSaving} loadingText={isEdit ? 'Saving...' : 'Creating...'}>{submitLabel}</Button>
          </div>
          )}
          </fieldset>
        </form>
      )}
    </div>
  );
};

export default RoleFormPage;
