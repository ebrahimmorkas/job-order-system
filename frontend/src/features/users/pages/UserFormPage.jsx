import { useEffect, useMemo, useState } from 'react';
import InputField from '../../../components/common/InputField';
import TextArea from '../../../components/common/TextArea';
import Button from '../../../components/common/Buttons';
import Card from '../../../components/common/Card';
import Alert from '../../../components/common/Alert';
import Badge from '../../../components/common/Badge';
import Spinner from '../../../components/common/Spinner';
import { todayString } from '../../../components/common/DateRangeFields';
import { useUnsavedChanges } from '../../../components/common/UnsavedChanges';
import { BackIcon } from '../../../components/common/ActionIcons';
import RoleAssignments from '../components/RoleAssignments';
import ExtraAccess from '../components/ExtraAccess';
import * as usersApi from '../api/usersApi';
import { useAccess } from '../../access/hooks/useAccess';

// Same rules as the backend (constants/rbacConstants.js).
const NAME_MAX_LENGTH = 50;
const USERNAME_MAX_LENGTH = 30;
const USERNAME_PATTERN = /^[a-z][a-z0-9._-]{2,29}$/;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const EMAIL_MAX_LENGTH = 100;
const PHONE_PATTERN = /^\+?\d{10,13}$/;
const ADDRESS_MAX_LENGTH = 300;

const EMPTY_FORM = {
  details: { name: '', username: '', password: '', email: '', phone: '', address: '' },
  roles: [],
  extraModules: [],
  extraMasters: [],
};

// What gets saved, as one string - compared with the loaded one to know
// whether anything changed.
const toSnapshot = (form) => JSON.stringify(form);

// Saved extra module options (one per permission) -> one block per module.
const groupExtraModules = (entries) => {
  const groups = [];
  for (const { module, permission, startDate, endDate } of entries) {
    let group = groups.find((g) => g.module === module);
    if (!group) groups.push(group = { module, permissions: {} });
    group.permissions[permission] = { startDate, endDate: endDate || '' };
  }
  return groups;
};

// The server's field errors ({ field, message }) by the key the form shows
// them under: "roles.<id>", "extraModules.<module>" ("extraModules.masters.create"
// shows on Masters), "extraMasters.<id>"; numbered paths ("roles.0.startDate")
// show on their list.
const toFieldErrors = (errors) => {
  const fieldErrors = {};
  for (const { field, message } of errors || []) {
    const [list, item] = field.split('.');
    const key = item && !/^\d+$/.test(item) ? `${list}.${item}` : list;
    if (!fieldErrors[key]) fieldErrors[key] = message;
  }
  return fieldErrors;
};

// The end before the start ('' start = today).
const isBackwards = ({ startDate, endDate }, today) => !!endDate && endDate < (startDate || today);

/**
 * Add a user or edit one: details, roles from Role Master (one, or several
 * when allowed) and, when allowed, extra access of their own - every role and
 * every extra option with its own dates. Leaving with unsaved changes asks first.
 *
 * @param {Object} props
 * @param {'create'|'edit'} props.mode
 * @param {string} [props.userId] - The user to edit
 * @param {(message: string) => void} props.onDone - Back to the list after saving
 * @param {() => void} props.onBack
 */
const UserFormPage = ({ mode, userId, onDone, onBack }) => {
  const { access } = useAccess();
  const isEdit = mode === 'edit';

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [options, setOptions] = useState(null); // form data
  const [form, setForm] = useState(EMPTY_FORM);
  const [savedSnapshot, setSavedSnapshot] = useState(() => toSnapshot(EMPTY_FORM));
  const [status, setStatus] = useState('A');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([usersApi.getFormData(), isEdit ? usersApi.getUser(userId) : null])
      .then(([formData, loaded]) => {
        if (cancelled) return;
        setOptions(formData);
        if (!loaded) return;
        const { user } = loaded;
        setStatus(user.status);
        const loadedForm = {
          details: { name: user.name, username: user.username, password: '', email: user.email || '', phone: user.phone || '', address: user.address || '' },
          roles: user.assignedRoles.map(({ roleId, startDate, endDate }) => ({ roleId, startDate, endDate: endDate || '' })),
          extraModules: groupExtraModules(user.extraModules),
          extraMasters: user.extraMasters.map(({ masterId, isWholeMaster, valueIds, startDate, endDate }) => ({ masterId, isWholeMaster, valueIds, startDate, endDate: endDate || '' })),
        };
        setForm(loadedForm);
        setSavedSnapshot(toSnapshot(loadedForm));
      })
      .catch((err) => !cancelled && setLoadError(err.message))
      .finally(() => !cancelled && setIsLoading(false));
    return () => { cancelled = true; };
  }, [isEdit, userId]);

  const isDirty = useMemo(() => !isLoading && !loadError && toSnapshot(form) !== savedSnapshot, [isLoading, loadError, form, savedSnapshot]);
  const confirmLeave = useUnsavedChanges(isDirty && !isSaving);

  const clearError = (key) => {
    if (key && fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: '' }));
    if (formError) setFormError('');
  };
  const setDetail = (field, value) => {
    setForm((prev) => ({ ...prev, details: { ...prev.details, [field]: value } }));
    clearError(field);
  };
  const setRoles = (roles, errorKey) => {
    setForm((prev) => ({ ...prev, roles }));
    clearError(errorKey);
    clearError('roles');
  };
  const setExtras = ({ modules, masters }, errorKey) => {
    setForm((prev) => ({ ...prev, ...(modules && { extraModules: modules }), ...(masters && { extraMasters: masters }) }));
    clearError(errorKey);
  };

  // Roles and extra access: only with Users > Assign role (the owner always),
  // and never on your own account - the backend keeps them as they are.
  const canChangeRoles = options?.canAssignRole === true && userId !== access.userId;
  const canGiveExtraAccess = canChangeRoles && options?.settings.canGiveExtraAccess === true;

  const validate = (today) => {
    const errors = {};
    const { details } = form;
    const name = details.name.trim();
    const username = details.username.trim().toLowerCase();
    if (!name) errors.name = 'Enter a name';
    else if (name.length < 2) errors.name = 'The name must be at least 2 characters';
    if (!username) errors.username = 'Enter a login username';
    else if (!USERNAME_PATTERN.test(username)) errors.username = '3-30 characters: letters, numbers, dot, dash or underscore, starting with a letter';
    if (!isEdit && !details.password) errors.password = 'Enter a password';
    else if (details.password && details.password.length < PASSWORD_MIN_LENGTH) errors.password = `The password must be at least ${PASSWORD_MIN_LENGTH} characters`;
    if (details.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email.trim())) errors.email = 'Enter a valid email';
    if (details.phone.trim() && !PHONE_PATTERN.test(details.phone.trim())) errors.phone = 'Phone must be 10 to 13 digits, optionally starting with +';

    for (const entry of canChangeRoles ? form.roles : []) {
      if (isBackwards(entry, today)) errors[`roles.${entry.roleId}`] = 'The end date is before the start date';
    }
    if (canGiveExtraAccess) {
      for (const { module, permissions } of form.extraModules) {
        const ticked = Object.values(permissions);
        if (ticked.length === 0) errors[`extraModules.${module}`] = 'Tick at least one option, or remove the module';
        else if (ticked.some((dates) => isBackwards(dates, today))) errors[`extraModules.${module}`] = 'An end date is before its start date';
      }
      for (const entry of form.extraMasters) {
        if (!entry.isWholeMaster && entry.valueIds.length === 0) errors[`extraMasters.${entry.masterId}`] = 'Pick at least one value, or tick "Whole master"';
        else if (isBackwards(entry, today)) errors[`extraMasters.${entry.masterId}`] = 'The end date is before the start date';
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // The browser's today: an empty start date means "from today" here.
    const today = todayString();
    if (isSaving || !validate(today)) return;
    const { details } = form;
    const dates = ({ startDate, endDate }) => ({ startDate: startDate || today, endDate: endDate || null });
    const payload = {
      name: details.name.trim(),
      username: details.username.trim().toLowerCase(),
      email: details.email.trim() || null,
      phone: details.phone.trim() || null,
      address: details.address.trim() || null,
      roles: form.roles.map((entry) => ({ roleId: entry.roleId, ...dates(entry) })),
      extraModules: form.extraModules.flatMap(({ module, permissions }) =>
        Object.entries(permissions).map(([permission, range]) => ({ module, permission, ...dates(range) }))),
      extraMasters: form.extraMasters.map((entry) => ({
        masterId: entry.masterId,
        isWholeMaster: entry.isWholeMaster,
        valueIds: entry.isWholeMaster ? [] : entry.valueIds,
        ...dates(entry),
      })),
    };
    if (details.password) payload.password = details.password;
    setIsSaving(true);
    setFormError('');
    try {
      if (isEdit) {
        await usersApi.updateUser(userId, payload);
        onDone('User saved.');
      } else {
        await usersApi.createUser(payload);
        onDone('User created.');
      }
    } catch (err) {
      const errors = toFieldErrors(err.errors);
      setFieldErrors(errors);
      // A message not tied to a field (e.g. the users limit) goes on top.
      if (Object.keys(errors).length === 0) setFormError(err.message);
      setIsSaving(false);
    }
  };

  const goBack = () => confirmLeave(onBack);

  if (isLoading) return <div className="py-24 flex justify-center"><Spinner size="lg" /></div>;

  const { details } = form;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <button type="button" onClick={goBack} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 cursor-pointer">
          <BackIcon className="w-4 h-4" /> Back to users
        </button>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'Edit user' : 'New user'}</h1>
          {isEdit && <Badge variant={status === 'A' ? 'green' : 'gray'} dot>{status === 'A' ? 'Active' : 'Inactive'}</Badge>}
        </div>
      </div>

      {loadError ? (
        <Alert variant="error">{loadError}</Alert>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {formError && <Alert variant="error">{formError}</Alert>}

          <Card variant="outlined" title="Details">
            <div className="grid gap-5 sm:grid-cols-2">
              <InputField
                label="Name"
                name="name"
                placeholder="e.g. Ravi Kumar"
                value={details.name}
                onChange={(e) => setDetail('name', e.target.value)}
                error={fieldErrors.name}
                maxLength={NAME_MAX_LENGTH}
                required
                disabled={isSaving}
                autoFocus={!isEdit}
              />
              <InputField
                label="Login username"
                name="username"
                placeholder="e.g. ravi.k"
                value={details.username}
                onChange={(e) => setDetail('username', e.target.value)}
                error={fieldErrors.username}
                maxLength={USERNAME_MAX_LENGTH}
                required
                disabled={isSaving}
                autoComplete="off"
              />
              <div>
                <InputField
                  label={isEdit ? 'New password' : 'Password'}
                  name="password"
                  type="password"
                  placeholder={isEdit ? 'Leave empty to keep the current one' : `At least ${PASSWORD_MIN_LENGTH} characters`}
                  value={details.password}
                  onChange={(e) => setDetail('password', e.target.value)}
                  error={fieldErrors.password}
                  maxLength={PASSWORD_MAX_LENGTH}
                  required={!isEdit}
                  disabled={isSaving}
                  autoComplete="new-password"
                />
                {isEdit && !fieldErrors.password && <p className="mt-1 text-xs text-gray-500">A new password logs the user out everywhere.</p>}
              </div>
              <InputField
                label="Email"
                name="email"
                type="email"
                placeholder="Optional"
                value={details.email}
                onChange={(e) => setDetail('email', e.target.value)}
                error={fieldErrors.email}
                maxLength={EMAIL_MAX_LENGTH}
                disabled={isSaving}
              />
              <InputField
                label="Phone"
                name="phone"
                type="tel"
                placeholder="Optional"
                value={details.phone}
                onChange={(e) => setDetail('phone', e.target.value)}
                error={fieldErrors.phone}
                maxLength={14}
                disabled={isSaving}
              />
              <div className="sm:col-span-2">
                <TextArea
                  label="Address"
                  name="address"
                  placeholder="Optional"
                  value={details.address}
                  onChange={(e) => setDetail('address', e.target.value)}
                  maxLength={ADDRESS_MAX_LENGTH}
                  rows={2}
                  disabled={isSaving}
                />
                {fieldErrors.address && <p className="mt-1 text-sm text-red-600" role="alert">{fieldErrors.address}</p>}
              </div>
            </div>
          </Card>

          {canChangeRoles && (
          <Card
            variant="outlined"
            title={options.settings.canGiveSeveralRoles ? 'Roles' : 'Role'}
            subtitle="From Role Master. Start date empty = from today; end date empty = no end."
          >
            <RoleAssignments
              roles={form.roles}
              onChange={setRoles}
              allRoles={options.roles}
              canGiveSeveral={options.settings.canGiveSeveralRoles}
              errors={fieldErrors}
              disabled={isSaving}
            />
          </Card>
          )}

          {canGiveExtraAccess && (
            <Card variant="outlined" title="Extra access" subtitle="Only for this user, on top of the roles.">
              <ExtraAccess
                modules={form.extraModules}
                masters={form.extraMasters}
                onChange={setExtras}
                availableModules={options.modules}
                availableMasters={options.masters}
                errors={fieldErrors}
                disabled={isSaving}
              />
            </Card>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={goBack} disabled={isSaving}>Cancel</Button>
            <Button type="submit" loading={isSaving} loadingText={isEdit ? 'Saving...' : 'Creating...'}>{isEdit ? 'Save changes' : 'Create user'}</Button>
          </div>
        </form>
      )}
    </div>
  );
};

export default UserFormPage;
