import Checkbox from '../../../components/common/Checkbox';
import { roleMastersOf } from '../userAccess';

/**
 * The master values one user's master roles give, ticked: untick a value,
 * or "All values", to take it away from this user only.
 *
 * @param {Object} props
 * @param {Array} props.roles - The user's active roles (form-data roles)
 * @param {Array} props.revokedMasters - [{ masterId, isWholeMaster, valueIds }]
 * @param {(revokedMasters: Array) => void} props.onChange
 * @param {Array} props.availableMasters - [{ _id, name, values: [{ _id, name, status }] }]
 * @param {boolean} props.disabled
 */
const RoleMasterAccess = ({ roles, revokedMasters, onChange, availableMasters, disabled }) => {
  const fromRoles = roleMastersOf(roles);
  const masters = availableMasters.filter((master) => fromRoles.has(master._id));
  if (masters.length === 0) return null;

  // What was taken from masterId becomes taken (value ids) - or all of it.
  const setTaken = (masterId, taken, isWholeMaster = false) => {
    const others = revokedMasters.filter((entry) => entry.masterId !== masterId);
    if (!isWholeMaster && taken.length === 0) return onChange(others);
    const entry = { masterId, isWholeMaster, valueIds: isWholeMaster ? [] : taken };
    const at = revokedMasters.findIndex((r) => r.masterId === masterId);
    onChange(at === -1 ? [...revokedMasters, entry] : revokedMasters.map((r, i) => (i === at ? entry : r)));
  };

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Master values from roles</h3>
        <p className="text-xs text-gray-500">Untick a value, or All values, to take it away for this user only.</p>
      </div>
      {masters.map((master) => {
        const given = fromRoles.get(master._id);
        const values = given.isWholeMaster ? master.values : master.values.filter((v) => given.valueIds.has(v._id));
        const valueIds = values.map((v) => v._id);
        const revoked = revokedMasters.find((r) => r.masterId === master._id);
        const taken = revoked ? (revoked.isWholeMaster ? valueIds : revoked.valueIds) : [];
        const toggleValue = (valueId, isOn) => {
          const next = isOn ? taken.filter((id) => id !== valueId) : [...taken, valueId];
          // Every value taken away = the whole master.
          if (next.length >= valueIds.length) setTaken(master._id, [], true);
          else setTaken(master._id, valueIds.filter((id) => next.includes(id)));
        };
        return (
          <div key={master._id} className="rounded-lg border border-gray-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-medium text-gray-900">{master.name}</p>
              <Checkbox
                name={`role-master-${master._id}-all`}
                label={given.isWholeMaster ? 'All values (whole master)' : 'All values'}
                checked={!revoked}
                onChange={(e) => setTaken(master._id, [], !e.target.checked)}
                disabled={disabled}
                aria-label={`${master.name}: All values`}
              />
            </div>
            {revoked && (
              <p className="mt-1 text-xs text-amber-700">
                {revoked.isWholeMaster ? 'Taken away: the whole master' : `Taken away: ${taken.length} of ${valueIds.length} values`}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
              {values.map((v) => (
                <Checkbox
                  key={v._id}
                  name={`role-master-${master._id}-${v._id}`}
                  label={v.status === 'A' ? v.name : `${v.name} (inactive)`}
                  checked={!taken.includes(v._id)}
                  onChange={(e) => toggleValue(v._id, e.target.checked)}
                  disabled={disabled}
                  aria-label={`${master.name}: ${v.name}`}
                />
              ))}
              {values.length === 0 && <p className="text-sm text-gray-500">No values yet.</p>}
            </div>
          </div>
        );
      })}
    </section>
  );
};

export default RoleMasterAccess;
