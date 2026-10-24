// Accent bar colours by tone (the status colours: overdue red, hold amber...).
const TONES = {
  indigo: 'bg-indigo-500',
  gray: 'bg-gray-400',
  blue: 'bg-blue-500',
  amber: 'bg-amber-400',
  red: 'bg-red-500',
  green: 'bg-emerald-500',
};

/**
 * One number on the dashboard with its label and a short hint.
 *
 * @param {Object} props
 * @param {string} props.label
 * @param {number} props.value
 * @param {string} [props.hint]
 * @param {keyof TONES} [props.tone]
 * @param {() => void} [props.onClick] - opens the matching list
 */
const StatTile = ({ label, value, hint, tone = 'indigo', onClick }) => {
  const content = (
    <>
      <span className={`absolute inset-y-4 left-0 w-1 rounded-r ${TONES[tone]}`} aria-hidden="true" />
      <span className="block text-sm font-medium text-gray-500">{label}</span>
      <span className="mt-1 block text-3xl font-semibold tabular-nums text-gray-900">{value}</span>
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </>
  );
  const className = 'relative block w-full rounded-xl border border-gray-200 bg-white px-5 py-4 text-left shadow-sm';
  if (!onClick) return <div className={className}>{content}</div>;
  return (
    <button type="button" onClick={onClick} className={`${className} transition-colors hover:border-indigo-200 hover:bg-indigo-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer`}>
      {content}
    </button>
  );
};

export default StatTile;
