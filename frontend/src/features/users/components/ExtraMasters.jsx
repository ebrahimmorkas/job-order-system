import Dropdown from '../../../components/common/DropDown';
import Checkbox from '../../../components/common/Checkbox';
import IconButton from '../../../components/common/IconButton';
import DateRangeFields from '../../../components/common/DateRangeFields';
import { TrashIcon } from '../../../components/common/ActionIcons';

/**
 * Extra master values of one user, on top of their roles: role-provided
 * masters, whole or some values (view only, like a master role), each with
 * its own dates. Start empty = today, end empty = no end.
 *
 * @param {Object} props
 * @param {Array} props.masters - [{ masterId, isWholeMaster, valueIds, startDate, endDate }]
 * @param {(masters: Array, errorKey?: string) => void} props.onChange
 * @param {Array} props.availableMasters - [{ _id, name, values: [{ _id, name, status }] }]
 * @param {Object} props.errors - extraMasters, extraMasters.<masterId>
 * @param {boolean} props.disabled
 */
const ExtraMasters = ({ masters, onChange, availableMasters, errors, disabled }) => {
  const masterById = new Map(availableMasters.map((m) => [m._id, m]));
  const masterOptions = availableMasters
    .filter((m) => !masters.some((added) => added.masterId === m._id))
    .map((m) => ({ value: m._id, label: m.name }));

  const addMaster = (id) => id && onChange([...masters, { masterId: id, isWholeMaster: false, valueIds: [], startDate: '', endDate: '' }], 'extraMasters');
  const removeMaster = (id) => onChange(masters.filter((m) => m.masterId !== id), `extraMasters.${id}`);
  const setMaster = (id, changes) => onChange(masters.map((m) => (m.masterId === id ? { ...m, ...changes } : m)), `extraMasters.${id}`);

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Extra master values</h3>
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
  );
};

export default ExtraMasters;
