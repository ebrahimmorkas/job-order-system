import Badge from '../../../components/common/Badge';
import StepBadge from '../../jobOrders/components/StepBadge';
import { durationTextOf, formatDueAt, timeStatusOf } from '../../jobOrders/workTime';

/**
 * One piece of work on a job order: the master value, the user's step, who
 * else does it, and when it is due - with the time left, "Overdue",
 * "Completed", not counting until the first step, or "No deadline".
 *
 * @param {Object} props
 * @param {{ masterName, valueName, assignedAt, completeIn, timeStartsOn, dueAt, startedAt, step, coWorkers: string[] }} props.work
 * @param {number} props.now - The current time (ms), see utils/useNow
 */
const WorkItem = ({ work, now }) => {
  const status = timeStatusOf(work, now);
  // From when the time counts: the work given, or their own start.
  const from = work.timeStartsOn === 'onFirstStep' ? work.startedAt : work.assignedAt;

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-gray-900 break-words">{work.valueName}</span>
        <span className="text-xs text-gray-500 break-words">{work.masterName}</span>
        {work.step !== undefined && <StepBadge step={work.step} />}
        {(!status.isCompleted || status.hasDeadline) && <Badge variant={status.variant} size="sm">{status.text}</Badge>}
      </div>
      {work.dueAt && (
        <p className="text-xs text-gray-600">
          Due {formatDueAt(work.dueAt)}
          {work.completeIn && from && <span className="text-gray-400"> ({durationTextOf(work.completeIn)} from {formatDueAt(from)})</span>}
        </p>
      )}
      {work.coWorkers.length > 0 && <p className="text-xs text-gray-500 break-words">With {work.coWorkers.join(', ')}</p>}
    </div>
  );
};

export default WorkItem;
