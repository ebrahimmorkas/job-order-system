import InputField from '../../../components/common/InputField';
import Dropdown from '../../../components/common/DropDown';
import { MEASURED_AS, ROUND_UP_STEPS } from '../controlTypes';

const ROUND_OPTIONS = [{ value: 'none', label: 'Not rounded' }, ...ROUND_UP_STEPS.map((step) => ({ value: String(step), label: `Up to the next ${step}` }))];

/**
 * The units of the unit dropdown (one row per choice): how each is measured,
 * its rate (filled in on the job order, still editable) and how its size is
 * charged - each measurement rounded up, wastage added, a minimum size.
 *
 * @param {Object} props
 * @param {Array<{ key, name, measuredAs, rate, roundUpTo, minimumSize, wastagePercent }>} props.options - The choices, in order
 * @param {(key: string, changes: Object) => void} props.onChange
 * @param {Object} props.errors - "<key>.<field>" -> message
 * @param {boolean} props.disabled
 */
const UnitOptionsEditor = ({ options, onChange, errors, disabled }) => {
  if (options.length === 0) return <p className="text-sm text-gray-500">Add the units as choices above (e.g. sq ft, meter, cm), then set each one here.</p>;
  return (
    <div className="space-y-4">
      {options.map((option) => {
        const error = (field) => errors[`${option.key}.${field}`];
        return (
          <fieldset key={option.key} className="min-w-0 rounded-lg border border-gray-200 p-4">
            <legend className="px-1 text-sm font-semibold text-gray-900 break-words">{option.name}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Dropdown
                label="Measured as"
                name={`measuredAs-${option.key}`}
                options={MEASURED_AS.map((way) => ({ value: way.value, label: `${way.label} (${way.hint})` }))}
                value={option.measuredAs || 'number'}
                onChange={(value) => onChange(option.key, { measuredAs: value || 'number' })}
                disabled={disabled}
                aria-label={`How ${option.name} is measured`}
              />
              <InputField
                label="Rate (optional)"
                name={`rate-${option.key}`}
                placeholder="e.g. 100 per unit"
                inputMode="decimal"
                value={option.rate ?? ''}
                onChange={(e) => onChange(option.key, { rate: e.target.value })}
                error={error('rate')}
                disabled={disabled}
              />
              <Dropdown
                label="Round each measurement"
                name={`roundUpTo-${option.key}`}
                options={ROUND_OPTIONS}
                value={option.roundUpTo === null || option.roundUpTo === undefined || option.roundUpTo === '' ? 'none' : String(option.roundUpTo)}
                onChange={(value) => onChange(option.key, { roundUpTo: value && value !== 'none' ? value : '' })}
                disabled={disabled}
                aria-label={`Rounding of ${option.name}`}
              />
              <InputField
                label="Minimum size per piece (optional)"
                name={`minimumSize-${option.key}`}
                placeholder="e.g. 1"
                inputMode="decimal"
                value={option.minimumSize ?? ''}
                onChange={(e) => onChange(option.key, { minimumSize: e.target.value })}
                error={error('minimumSize')}
                disabled={disabled}
              />
              <InputField
                label="Wastage % (optional)"
                name={`wastagePercent-${option.key}`}
                placeholder="e.g. 5"
                inputMode="decimal"
                value={option.wastagePercent ?? ''}
                onChange={(e) => onChange(option.key, { wastagePercent: e.target.value })}
                error={error('wastagePercent')}
                disabled={disabled}
              />
            </div>
          </fieldset>
        );
      })}
      <p className="text-xs text-gray-500">
        The size charged = each measurement rounded up, multiplied, the wastage added, and at least the minimum size.
        E.g. 2.3 × 4.1 rounded up to the next 0.5 = 2.5 × 4.5 = 11.25.
      </p>
    </div>
  );
};

export default UnitOptionsEditor;
