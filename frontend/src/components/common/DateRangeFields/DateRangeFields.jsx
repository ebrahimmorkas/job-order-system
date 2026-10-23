import DatePicker from '../DatePicker';
import { toDayString } from './dayStrings';

/**
 * A "from - to" pair of optional dates ('YYYY-MM-DD' strings, '' = empty).
 * The end can't be picked before the start.
 *
 * @param {Object} props
 * @param {string} props.name - Base name: the inputs are `${name}-start` / `${name}-end`
 * @param {string} props.startDate
 * @param {string} props.endDate
 * @param {(changes: { startDate?: string, endDate?: string }) => void} props.onChange
 * @param {string} [props.startPlaceholder] - Shown while empty, e.g. "Today"
 * @param {string} [props.endPlaceholder] - Shown while empty, e.g. "No end"
 * @param {string} [props.error]
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.compact] - Smaller labels, for rows inside a list
 */
const DateRangeFields = ({
  name,
  startDate,
  endDate,
  onChange,
  startPlaceholder = 'Today',
  endPlaceholder = 'No end',
  error = '',
  disabled = false,
  compact = false,
}) => (
  <div>
    <div className={`grid grid-cols-2 ${compact ? 'gap-2' : 'gap-3'}`}>
      <DatePicker
        label="Start date"
        name={`${name}-start`}
        value={startDate || null}
        onChange={(date) => onChange({ startDate: toDayString(date) })}
        placeholder={startPlaceholder}
        disabled={disabled}
        className={compact ? '[&_label]:text-xs' : ''}
      />
      <DatePicker
        label="End date"
        name={`${name}-end`}
        value={endDate || null}
        onChange={(date) => onChange({ endDate: toDayString(date) })}
        minDate={startDate ? new Date(`${startDate}T00:00:00`) : undefined}
        placeholder={endPlaceholder}
        disabled={disabled}
        className={compact ? '[&_label]:text-xs' : ''}
      />
    </div>
    {error && <p className="mt-1 text-sm text-red-600" role="alert">{error}</p>}
  </div>
);

export default DateRangeFields;
