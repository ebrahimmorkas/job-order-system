import Dropdown from '../../../components/common/DropDown';
import Checkbox from '../../../components/common/Checkbox';
import IconButton from '../../../components/common/IconButton';
import DateRangeFields from '../../../components/common/DateRangeFields';
import { TrashIcon } from '../../../components/common/ActionIcons';
import { PERMISSIONS, MODULE_LABELS } from '../../roles/roleTypes';

const PERMISSION_LABELS = Object.fromEntries(PERMISSIONS.map((p) => [p.key, p.label]));

/**
 * Extra access of one user, on top of their roles:
 * - modules: tick single options (e.g. Masters: Create), each with its own dates;
 * - masters: role-provided masters, whole or some values (view only, like a
 *   master role), each with its own dates.
 * Start empty = today, end empty = no end.
 *
 * @param {Object} props
 * @param {Array} props.modules - [{ module, permissions: { [permission]: { startDate, endDate } } }]
 * @param {Array} props.masters - [{ masterId, isWholeMaster, valueIds, startDate, endDate }]
 * @param {(changes: { modules?: Array, masters?: Array }, errorKey?: string) => void} props.onChange
 * @param {Array} props.availableModules - [{ key, label, permissions }]
 * @param {Array} props.availableMasters - [{ _id, name, values: [{ _id, name, status }] }]
 * @param {Object} props.errors - extraModules, extraModules.<module>, extraMasters, extraMasters.<masterId>
 * @param {boolean} props.disabled
 */
const ExtraAccess = ({ modules, masters, onChange, availableModules, availableMasters, errors, disabled }) => {
  const moduleByKey = new Map(availableModules.map((m) => [m.key, m]));
  const masterById = new Map(availableMasters.map((m) => [m._id, m]));

  const moduleOptions = availableModules
    .filter((m) => !modules.some((added) => added.module === m.key))
    .map((m) => ({ value: m.key, label: m.label }));
  const masterOptions = availableMasters
    .filter((m) => !masters.some((added) => added.masterId === m._id))
    .map((m) => ({ value: m._id, label: m.name }));

  // ---- modules ----
  const setModules = (next, key) => onChange({ modules: next }, key);
  const addModule = (key) => key && setModules([...modules, { module: key, permissions: {} }], 'extraModules');
  const removeModule = (key) => setModules(modules.filter((m) => m.module !== key), `extraModules.${key}`);
  const updatePermissions = (key, update) =>
    setModules(modules.map((m) => (m.module === key ? { ...m, permissions: update(m.permissions) } : m)), `extraModules.${key}`);
  const togglePermission = (key, permission, isOn) =>
    updatePermissions(key, (permissions) => {
      const next = { ...permissions };
      if (isOn) next[permission] = { startDate: '', endDate: '' };
      else delete next[permission];
      return next;
    });
  const setPermissionDates = (key, permission, changes) =>
    updatePermissions(key, (permissions) => ({ ...permissions, [permission]: { ...permissions[permission], ...changes } }));

  // ---- masters ----
  const setMasters = (next, key) => onChange({ masters: next }, key);
  const addMaster = (id) => id && setMasters([...masters, { masterId: id, isWholeMaster: false, valueIds: [], startDate: '', endDate: '' }], 'extraMasters');
  const removeMaster = (id) => setMasters(masters.filter((m) => m.masterId !== id), `extraMasters.${id}`);
  const setMaster = (id, changes) => setMasters(masters.map((m) => (m.masterId === id ? { ...m, ...changes } : m)), `extraMasters.${id}`);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Module options</h3>
          <p className="text-xs text-gray-500">Tick single options, each with its own dates. Create, Edit and Delete work together with View - from a role or ticked here.</p>
        </div>
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
        {modules.map(({ module, permissions }) => {
          const available = moduleByKey.get(module);
          const label = available?.label || MODULE_LABELS[module] || module;
          const error = errors[`extraModules.${module}`];
          // The module's options, plus any saved one it no longer has.
          const keys = [...new Set([...(available?.permissions || []), ...Object.keys(permissions)])];
          return (
            <div key={module} className={`rounded-lg border p-4 ${error ? 'border-red-300 bg-red-50/40' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">{label}</p>
                  {!available && <p className="text-xs text-amber-700">No longer available - remove it</p>}
                </div>
                <IconButton label={`Remove ${label} extra access`} icon={TrashIcon} variant="danger" size="sm" onClick={() => removeModule(module)} disabled={disabled} />
              </div>
              <div className="mt-2 divide-y divide-gray-100">
                {keys.map((permission) => {
                  const dates = permissions[permission];
                  return (
                    <div key={permission} className="py-2.5 sm:grid sm:grid-cols-[10rem_1fr] sm:items-start sm:gap-4">
                      <div className="pt-2">
                        <Checkbox
                          name={`extra-${module}-${permission}`}
                          label={PERMISSION_LABELS[permission] || permission}
                          checked={!!dates}
                          onChange={(e) => togglePermission(module, permission, e.target.checked)}
                          disabled={disabled}
                          aria-label={`${label}: ${PERMISSION_LABELS[permission] || permission}`}
                        />
                      </div>
                      {dates && (
                        <div className="mt-2 sm:mt-0 sm:max-w-md">
                          <DateRangeFields
                            name={`extra-${module}-${permission}`}
                            startDate={dates.startDate}
                            endDate={dates.endDate}
                            onChange={(changes) => setPermissionDates(module, permission, changes)}
                            disabled={disabled}
                            compact
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {error && <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>}
            </div>
          );
        })}
        {errors.extraModules && <p className="text-sm text-red-600" role="alert">{errors.extraModules}</p>}
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Master values</h3>
          <p className="text-xs text-gray-500">View of a whole master or some of its values, like a master role, with its own dates.</p>
        </div>
        {availableMasters.length === 0 && masters.length === 0 ? (
          <p className="text-sm text-gray-500">No master is set for roles yet. In Masters, edit a master and tick “Role will be provided for this master”.</p>
        ) : (
          <div className="sm:w-80">
            <Dropdown
              name="addExtraMaster"
              options={masterOptions}
              value=""
              onChange={addMaster}
              placeholder={masterOptions.length ? 'Add a master' : 'Every master is added'}
              searchable
              disabled={disabled || masterOptions.length === 0}
              aria-label="Add a master for extra access"
            />
          </div>
        )}
        {masters.map(({ masterId, isWholeMaster, valueIds, startDate, endDate }) => {
          const master = masterById.get(masterId);
          const name = master?.name || 'Master';
          const error = errors[`extraMasters.${masterId}`];
          const valueOptions = (master?.values || []).map((v) => ({ value: v._id, label: v.status === 'A' ? v.name : `${v.name} (inactive)` }));
          return (
            <div key={masterId} className={`rounded-lg border p-4 ${error ? 'border-red-300 bg-red-50/40' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">{name}</p>
                  {!master && <p className="text-xs text-amber-700">No longer set for roles - remove it</p>}
                </div>
                <IconButton label={`Remove ${name} extra access`} icon={TrashIcon} variant="danger" size="sm" onClick={() => removeMaster(masterId)} disabled={disabled} />
              </div>
              {master && (
                <div className="mt-3 space-y-3">
                  <Checkbox
                    name={`extra-whole-${masterId}`}
                    label="Whole master"
                    description="Every value, including ones added later."
                    checked={isWholeMaster}
                    onChange={(e) => setMaster(masterId, { isWholeMaster: e.target.checked })}
                    disabled={disabled}
                  />
                  {!isWholeMaster && (
                    <Dropdown
                      label="Values"
                      name={`extra-values-${masterId}`}
                      options={valueOptions}
                      multiple
                      value={valueIds}
                      onChange={(value) => setMaster(masterId, { valueIds: value })}
                      placeholder="Choose one or more"
                      searchable
                      disabled={disabled}
                      aria-label={`Extra values of ${name}`}
                    />
                  )}
                  <div className="sm:max-w-md">
                    <DateRangeFields
                      name={`extra-master-${masterId}`}
                      startDate={startDate}
                      endDate={endDate}
                      onChange={(changes) => setMaster(masterId, changes)}
                      disabled={disabled}
                    />
                  </div>
                </div>
              )}
              {error && <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>}
            </div>
          );
        })}
        {errors.extraMasters && <p className="text-sm text-red-600" role="alert">{errors.extraMasters}</p>}
      </section>
    </div>
  );
};

export default ExtraAccess;
