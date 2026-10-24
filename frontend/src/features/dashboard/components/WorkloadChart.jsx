import Tooltip from '../../../components/common/Tooltip';

// The work's state, in stacking order, with the status colours (overdue
// critical, on hold warning); always shown with the legend's labels.
const WORKLOAD_SERIES = [
  { key: 'inProgress', label: 'In progress', color: '#2a78d6' },
  { key: 'notStarted', label: 'Not started', color: '#a3a29c' },
  { key: 'onHold', label: 'On hold', color: '#fab219' },
  { key: 'overdue', label: 'Overdue', color: '#d03b3b' },
];

/**
 * Each person's open work as one horizontal bar, split by state, longest
 * first. Hover a part for its count; the total is written at the end.
 *
 * @param {Object} props
 * @param {Array<{ userId: string, name: string, total: number, notStarted: number, inProgress: number, onHold: number, overdue: number }>} props.workload
 * @param {number} props.moreCount - people left out (not the busiest)
 */
const WorkloadChart = ({ workload, moreCount = 0 }) => {
  const max = Math.max(1, ...workload.map((person) => person.total));

  return (
    <div>
      <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1" aria-label="Legend">
        {WORKLOAD_SERIES.map((series) => (
          <li key={series.key} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: series.color }} aria-hidden="true" />
            {series.label}
          </li>
        ))}
      </ul>
      <ul className="space-y-3" aria-label="Open work by person">
        {workload.map((person) => {
          const parts = WORKLOAD_SERIES.filter((series) => person[series.key] > 0);
          const summary = parts.map((series) => `${person[series.key]} ${series.label.toLowerCase()}`).join(', ');
          return (
            <li key={person.userId} className="grid grid-cols-[minmax(0,7rem)_1fr] items-center gap-3 sm:grid-cols-[minmax(0,9rem)_1fr]">
              <span className="truncate text-sm text-gray-700" title={person.name}>{person.name}</span>
              <div className="flex items-center gap-2" aria-label={`${person.name}: ${person.total} open - ${summary}`}>
                <div className="flex h-5 gap-[2px]" style={{ width: `${(person.total / max) * 100}%`, minWidth: '0.5rem' }}>
                  {parts.map((series, index) => (
                    <div key={series.key} className="h-full" style={{ flexGrow: person[series.key], flexBasis: 0 }}>
                      <Tooltip content={`${person.name} · ${series.label}: ${person[series.key]}`} wrapperClassName="!block h-full w-full" delay={0}>
                        <span
                          className={`block h-full w-full ${index === parts.length - 1 ? 'rounded-r-[4px]' : ''}`}
                          style={{ backgroundColor: series.color }}
                        />
                      </Tooltip>
                    </div>
                  ))}
                </div>
                <span className="shrink-0 text-xs font-medium tabular-nums text-gray-600">{person.total}</span>
              </div>
            </li>
          );
        })}
      </ul>
      {moreCount > 0 && <p className="mt-3 text-xs text-gray-500">And {moreCount} more {moreCount === 1 ? 'person' : 'people'} with less work.</p>}
    </div>
  );
};

export default WorkloadChart;
