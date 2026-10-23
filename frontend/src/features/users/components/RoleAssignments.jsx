import Dropdown from '../../../components/common/DropDown';
import Badge from '../../../components/common/Badge';
import Alert from '../../../components/common/Alert';
import IconButton from '../../../components/common/IconButton';
import DateRangeFields from '../../../components/common/DateRangeFields';
import { TrashIcon } from '../../../components/common/ActionIcons';
import { ROLE_TYPES } from '../../roles/roleTypes';

/**
 * The roles given to a user, each with its own dates (start empty = today,
 * end empty = no end). One role, or several when the vendor allows it.
 *
 * @param {Object} props
 * @param {Array} props.roles - [{ roleId, startDate, endDate }]
 * @param {(roles: Array, errorKey?: string) => void} props.onChange
 * @param {Array} props.allRoles - The vendor's roles [{ _id, name, type, status }]
 * @param {boolean} props.canGiveSeveral
 * @param {Object} props.errors - Field errors: roles, roles.<roleId>
 * @param {boolean} props.disabled
 */
const RoleAssignments = ({ roles, onChange, allRoles, canGiveSeveral, errors, disabled }) => {
  const roleById = new Map(allRoles.map((role) => [role._id, role]));
  // Inactive roles can't be newly given (one already given stays).
  const options = allRoles
    .filter((role) => role.status === 'A' && !roles.some((entry) => entry.roleId === role._id))
    .map((role) => ({ value: role._id, label: role.name }));
  const canAdd = canGiveSeveral || roles.length === 0;

  const add = (roleId) => roleId && onChange([...roles, { roleId, startDate: '', endDate: '' }], 'roles');
  const remove = (roleId) => onChange(roles.filter((entry) => entry.roleId !== roleId), `roles.${roleId}`);
  const setDates = (roleId, changes) =>
    onChange(roles.map((entry) => (entry.roleId === roleId ? { ...entry, ...changes } : entry)), `roles.${roleId}`);

  if (allRoles.length === 0) {
    return <Alert variant="info">No roles yet. Create roles in Role Master first, then give them here.</Alert>;
  }

  return (
    <div className="space-y-4">
      {canAdd ? (
        <div className="sm:w-80">
          <Dropdown
            name="addRole"
            options={options}
            value=""
            onChange={add}
            placeholder={options.length ? 'Add a role' : 'Every active role is added'}
            searchable
            disabled={disabled || options.length === 0}
            aria-label="Add a role"
          />
        </div>
      ) : (
        <p className="text-sm text-gray-500">One role per user. Remove it to give another.</p>
      )}

      {roles.map((entry) => {
        const role = roleById.get(entry.roleId);
        const name = role?.name || 'Role';
        const error = errors[`roles.${entry.roleId}`];
        return (
          <div key={entry.roleId} className={`rounded-lg border p-4 ${error ? 'border-red-300 bg-red-50/40' : 'border-gray-200'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-gray-900">{name}</p>
                {role && <Badge variant={role.type === 'module' ? 'blue' : 'purple'} size="sm">{ROLE_TYPES[role.type].label}</Badge>}
                {role && role.status !== 'A' && <Badge variant="gray" size="sm">Inactive</Badge>}
              </div>
              <IconButton label={`Remove ${name}`} icon={TrashIcon} variant="danger" size="sm" onClick={() => remove(entry.roleId)} disabled={disabled} />
            </div>
            <div className="mt-3 sm:max-w-md">
              <DateRangeFields
                name={`role-${entry.roleId}`}
                startDate={entry.startDate}
                endDate={entry.endDate}
                onChange={(changes) => setDates(entry.roleId, changes)}
                error={error}
                disabled={disabled}
              />
            </div>
          </div>
        );
      })}
      {roles.length === 0 && <p className="text-sm text-gray-500">No role yet - the user can be saved without one.</p>}
      {errors.roles && <p className="text-sm text-red-600" role="alert">{errors.roles}</p>}
    </div>
  );
};

export default RoleAssignments;
