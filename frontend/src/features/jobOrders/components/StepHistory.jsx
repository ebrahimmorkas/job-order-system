import { useId, useState } from 'react';
import { formatDueAt } from '../workTime';

/**
 * Every step someone moved their work to, newest first - shown on a click.
 *
 * @param {Object} props
 * @param {Array<{ name, percent, holdReason, at }>} props.history - Oldest first, as saved
 */
const StepHistory = ({ history }) => {
  const id = useId();
  const [isOpen, setIsOpen] = useState(false);
  if (!history?.length) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls={id}
        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 cursor-pointer"
      >
        {isOpen ? 'Hide history' : `History (${history.length})`}
      </button>
      {isOpen && (
        <ol id={id} className="mt-2 space-y-1.5 border-l-2 border-gray-100 pl-3">
          {[...history].reverse().map((entry, index) => (
            <li key={index} className="text-xs text-gray-600">
              <span className="font-medium text-gray-800">{entry.name}</span>
              {entry.percent !== null && entry.percent !== undefined && <span> · {entry.percent}%</span>}
              <span className="text-gray-400"> - {formatDueAt(entry.at)}</span>
              {entry.holdReason && <p className="text-gray-500 break-words">{entry.holdReason}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

export default StepHistory;
