import Badge from '../../../components/common/Badge';
import { durationTextOf, formatDueAt, timeLeftOf } from '../../jobOrders/workTime';

/**
 * One piece of work on a job order: the master value, who else does it, and
 * when it is due - with the time left, "Overdue" or "No deadline".
 *
 * @param {Object} props
 * @param {{ masterName, valueName, assignedAt, completeIn, dueAt, coWorkers: string[] }} props.work
 * @param {number} props.now - The current time (ms), see utils/useNow
 */
const WorkItem = ({ work, now }) => {
  const left = work.dueAt ? timeLeftOf(work.dueAt, now) : null;

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-gray-900 break-words">{work.valueName}</span>
        <span className="text-xs text-gray-500 break-words">{work.masterName}</span>
        {left
          ? <Badge variant={left.isOverdue ? 'red' : 'blue'} size="sm">{left.text}</Badge>
          : <Badge variant="gray" size="sm">No deadline</Badge>}
      </div>
      {work.dueAt && (
        <p className="text-xs text-gray-600">
          Due {formatDueAt(work.dueAt)}
          {work.completeIn && <span className="text-gray-400"> ({durationTextOf(work.completeIn)} from {formatDueAt(work.assignedAt)})</span>}
        </p>
      )}
      {work.coWorkers.length > 0 && <p className="text-xs text-gray-500 break-words">With {work.coWorkers.join(', ')}</p>}
    </div>
  );
};

export default WorkItem;
