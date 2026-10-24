import Dropdown from '../../../components/common/DropDown';
import Checkbox from '../../../components/common/Checkbox';
import IconButton from '../../../components/common/IconButton';
import DateRangeFields from '../../../components/common/DateRangeFields';
import { TrashIcon } from '../../../components/common/ActionIcons';
import { PERMISSIONS, MODULE_LABELS, togglePermission } from '../../roles/roleTypes';
import { roleModulesOf } from '../userAccess';

const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);
const PERMISSION_LABELS = Object.fromEntries(PERMISSIONS.map((p) => [p.key, p.label]));
const NO_DATES = { startDate: '', endDate: '' };

// Taken-away options in one order, so the same choice always saves the same.
const byModuleAndPermission = (a, b) => a.module.localeCompare(b.module) || PERMISSION_KEYS.indexOf(a.permission) - PERMISSION_KEYS.indexOf(b.permission);

/**
 * One user's module access, like the Role Master table: what the roles give
 * comes ticked - untick to take it away from this user only; tick more (when
 * extra access is allowed) to give extras, each with its own dates (shown
 * under the row). Start empty = today, end empty = no end.
 *
 * @param {Object} props
 * @param {Array} props.roles - The user's active roles (form-data roles)
 * @param {Array} props.extraModules - [{ module, permissions: { [permission]: { startDate, endDate } } }]
 * @param {Array} props.revokedModules - [{ module, permission }]
 * @param {(changes: { extraModules?: Array, revokedModules?: Array }, errorKey?: string) => void} props.onChange
 * @param {Array} props.availableModules - [{ key, label, permissions }]
 * @param {boolean} props.canGiveExtra - Options the roles don't give can be ticked
 * @param {Object} props.errors - extraModules, extraModules.<module>
 * @param {boolean} props.disabled
 */
const AccessTable = ({ roles, extraModules, revokedModules, onChange, availableModules, canGiveExtra, errors, disabled }) => {
  const moduleByKey = new Map(availableModules.map((m) => [m.key, m]));
  const fromRoles = roleModulesOf(roles);
  const order = availableModules.map((m) => m.key);
  const rank = (key) => (order.includes(key) ? order.indexOf(key) : order.length);
  const rows = [...new Set([...fromRoles.keys(), ...extraModules.map((m) => m.module)])].sort((a, b) => rank(a) - rank(b));

  const givenOf = (module) => fromRoles.get(module) || new Set();
  const extrasOf = (module) => extraModules.find((m) => m.module === module)?.permissions || {};
  // Ticked: from the roles and not taken away, or given as an extra.
  const tickedOf = (module) => {
    const revoked = revokedModules.filter((r) => r.module === module).map((r) => r.permission);
    const ticked = new Set([...givenOf(module)].filter((p) => !revoked.includes(p)));
    Object.keys(extrasOf(module)).forEach((p) => ticked.add(p));
    return ticked;
  };
  // Only what the roles give can change, unless extras are allowed.
  const canChange = (module, permission) => canGiveExtra || givenOf(module).has(permission);

  // The module's ticked options become next: what the roles give and isn't
  // in next is taken away; what's in next and the roles don't give is an
  // extra (keeping its dates).
  const setTicked = (module, next) => {
    const given = givenOf(module);
    const oldExtras = extrasOf(module);
    const extras = Object.fromEntries(next.filter((p) => !given.has(p)).map((p) => [p, oldExtras[p] || NO_DATES]));
    const revoked = [...given].filter((p) => !next.includes(p)).map((permission) => ({ module, permission }));
    const hasRow = extraModules.some((m) => m.module === module);
    let nextExtras = extraModules;
    // A role's module needs no extras row once it has no extras.
    if (given.size > 0 && Object.keys(extras).length === 0) nextExtras = extraModules.filter((m) => m.module !== module);
    else if (hasRow) nextExtras = extraModules.map((m) => (m.module === module ? { ...m, permissions: extras } : m));
    else nextExtras = [...extraModules, { module, permissions: extras }];
    onChange({
      extraModules: nextExtras,
      revokedModules: [...revokedModules.filter((r) => r.module !== module), ...revoked].sort(byModuleAndPermission),
    }, `extraModules.${module}`);
  };

  const allowedOf = (module) => PERMISSION_KEYS.filter((p) => moduleByKey.get(module)?.permissions.includes(p));
  const toggle = (module, permission, isOn) => {
    const ticked = tickedOf(module);
    let next = togglePermission([...ticked], permission, isOn, allowedOf(module));
    // Without extra access, extras stay as they are and none are added.
    if (!canGiveExtra) next = PERMISSION_KEYS.filter((p) => (next.includes(p) && givenOf(module).has(p)) || p in extrasOf(module));
    setTicked(module, next);
  };
  // "All": every option that can change here - or none of them.
  const changeableOf = (module) => allowedOf(module).filter((p) => canChange(module, p));
  const hasAll = (module) => {
    const ticked = tickedOf(module);
    const changeable = changeableOf(module);
    return changeable.length > 0 && changeable.every((p) => ticked.has(p));
  };
  const setAll = (module, isOn) => {
    const ticked = tickedOf(module);
    const changeable = changeableOf(module);
    setTicked(module, PERMISSION_KEYS.filter((p) => (isOn ? ticked.has(p) || changeable.includes(p) : ticked.has(p) && !changeable.includes(p))));
  };

  const addModule = (key) => key && onChange({ extraModules: [...extraModules, { module: key, permissions: {} }] }, 'extraModules');
  const removeModule = (key) => onChange({ extraModules: extraModules.filter((m) => m.module !== key) }, `extraModules.${key}`);
  const setExtraDates = (module, permission, changes) =>
    onChange({ extraModules: extraModules.map((m) => (m.module === module ? { ...m, permissions: { ...m.permissions, [permission]: { ...m.permissions[permission], ...changes } } } : m)) }, `extraModules.${module}`);

  const moduleOptions = availableModules
    .filter((m) => !rows.includes(m.key))
    .map((m) => ({ value: m.key, label: m.label }));
  const columns = PERMISSIONS.length + 3;

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Modules</h3>
        <p className="text-xs text-gray-500">
          {canGiveExtra
            ? 'Ticked from the roles - untick to take it away for this user only. Tick more to give extra access, with its own dates.'
            : 'Ticked from the roles - untick to take it away for this user only.'}
        </p>
      </div>
      {canGiveExtra && (
        <div className="sm:w-80">
          <Dropdown
            name="addExtraModule"
            options={moduleOptions}
            value=""
            onChange={addModule}
            placeholder={moduleOptions.length ? 'Add a module' : 'Every module is added'}
            searchable
            disabled={disabled || moduleOptions.length === 0}
            aria-label="Add a module for extra access"
          />
        </div>
      )}
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">{canGiveExtra ? 'No module yet: give a module role, or add a module.' : 'No module yet: give a module role.'}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th scope="col" className="px-4 py-2.5 text-left">Module</th>
                <th scope="col" className="px-3 py-2.5 text-center whitespace-nowrap">All</th>
                {PERMISSIONS.map((p) => <th key={p.key} scope="col" className="px-3 py-2.5 text-center whitespace-nowrap">{p.label}</th>)}
                <th scope="col" className="px-2 py-2.5"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((module) => {
                const available = moduleByKey.get(module);
                const label = available?.label || MODULE_LABELS[module] || module;
                const error = errors[`extraModules.${module}`];
                const isFromRoles = givenOf(module).size > 0;
                const ticked = tickedOf(module);
                const takenAway = [...givenOf(module)].filter((p) => !ticked.has(p));
                const extras = extrasOf(module);
                const extraKeys = PERMISSION_KEYS.filter((p) => p in extras);
                return [
                  <tr key={module} className={error ? 'bg-red-50/50' : undefined}>
                    <td className="px-4 py-2.5 align-top">
                      <span className="font-medium text-gray-900">{label}</span>
                      {!isFromRoles && <span className="block text-xs text-indigo-600">Extra access</span>}
                      {takenAway.length > 0 && <span className="block text-xs text-amber-700">Taken away: {takenAway.map((p) => PERMISSION_LABELS[p] || p).join(', ')}</span>}
                      {!available && <span className="block text-xs text-amber-700">No longer available</span>}
                      {error && <span className="block text-xs text-red-600" role="alert">{error}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center align-top border-r border-gray-100">
                      {available && changeableOf(module).length > 0 ? (
                        <span className="inline-flex justify-center">
                          <Checkbox
                            name={`access-${module}-all`}
                            checked={hasAll(module)}
                            onChange={(e) => setAll(module, e.target.checked)}
                            disabled={disabled}
                            aria-label={`${label}: All`}
                          />
                        </span>
                      ) : (
                        <span className="text-gray-300" aria-hidden="true">—</span>
                      )}
                    </td>
                    {PERMISSIONS.map((p) => (
                      <td key={p.key} className="px-3 py-2.5 text-center align-top">
                        {available?.permissions.includes(p.key) ? (
                          <span className="inline-flex justify-center">
                            <Checkbox
                              name={`access-${module}-${p.key}`}
                              checked={ticked.has(p.key)}
                              onChange={(e) => toggle(module, p.key, e.target.checked)}
                              disabled={disabled || !canChange(module, p.key)}
                              aria-label={`${label}: ${p.label}`}
                            />
                          </span>
                        ) : (
                          <span className="text-gray-300" aria-hidden="true">—</span>
                        )}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-right align-top">
                      {!isFromRoles && canGiveExtra && (
                        <IconButton label={`Remove ${label} extra access`} icon={TrashIcon} variant="danger" size="sm" onClick={() => removeModule(module)} disabled={disabled} />
                      )}
                    </td>
                  </tr>,
                  canGiveExtra && extraKeys.length > 0 && (
                    <tr key={`${module}-dates`} className="bg-indigo-50/30">
                      <td colSpan={columns} className="px-4 py-2">
                        <div className="space-y-2">
                          {extraKeys.map((permission) => (
                            <div key={permission} className="sm:grid sm:grid-cols-[10rem_1fr] sm:items-center sm:gap-4">
                              <p className="text-xs font-medium text-gray-600">Extra: {PERMISSION_LABELS[permission] || permission}</p>
                              <div className="mt-1 sm:mt-0 sm:max-w-md">
                                <DateRangeFields
                                  name={`extra-${module}-${permission}`}
                                  startDate={extras[permission].startDate}
                                  endDate={extras[permission].endDate}
                                  onChange={(changes) => setExtraDates(module, permission, changes)}
                                  disabled={disabled}
                                  compact
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>
      )}
      {errors.extraModules && <p className="text-sm text-red-600" role="alert">{errors.extraModules}</p>}
    </section>
  );
};

export default AccessTable;
