import Badge from '../../../components/common/Badge';
import { useNow } from '../../../utils/useNow';
import { formatDueAt, timeStatusOf } from '../workTime';
import StepBadge from './StepBadge';
import StepHistory from './StepHistory';

/**
 * How the work given on a job order is going (the owner's view): for each
 * value given to people, each person's step, % / hold reason, start, time
 * left and history. Nothing when no work was given.
 *
 * @param {Object} props
 * @param {Array} props.masters - The job order's masters as saved
 */
const WorkProgress = ({ masters }) => {
  const now = useNow();
  const given = masters.flatMap((master) => master.values.filter((value) => value.assignedTo?.length > 0).map((value) => ({ master, value })));
  if (given.length === 0) return null;

  return (
    <ul className="divide-y divide-gray-100">
      {given.map(({ master, value }) => (
        <li key={value.valueId} className="py-3 first:pt-0 last:pb-0">
          <p className="text-sm">
            <span className="font-medium text-gray-900 break-words">{value.name}</span>
            <span className="ml-2 text-xs text-gray-500 break-words">{master.name}</span>
          </p>
          <ul className="mt-2 space-y-3">
            {value.assignedTo.map((person) => {
              const status = timeStatusOf({
                dueAt: person.dueAt ?? value.dueAt,
                timeStartsOn: value.timeStartsOn,
                completeIn: value.completeIn,
                startedAt: person.startedAt,
                step: person.step,
              }, now);
              return (
                <li key={person.userId} className="rounded-lg border border-gray-200 px-3 py-2 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-gray-800 break-words">{person.name}</span>
                    <StepBadge step={person.step} />
                    {(!status.isCompleted || status.hasDeadline) && <Badge variant={status.variant} size="sm">{status.text}</Badge>}
                  </div>
                  {person.step?.holdReason && <p className="text-xs text-gray-600 break-words">On hold: {person.step.holdReason}</p>}
                  <p className="text-xs text-gray-500">
                    {person.startedAt ? `Started ${formatDueAt(person.startedAt)}` : 'Not started yet'}
                    {(person.dueAt ?? value.dueAt) && ` · due ${formatDueAt(person.dueAt ?? value.dueAt)}`}
                  </p>
                  <StepHistory history={person.history} />
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
};

export default WorkProgress;
