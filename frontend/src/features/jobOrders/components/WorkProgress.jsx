import Badge from '../../../components/common/Badge';
import { useNow } from '../../../utils/useNow';
import { formatDueAt, timeStatusOf } from '../workTime';
import StepBadge from './StepBadge';
import StepHistory from './StepHistory';
import { itemLabelOf } from '../jobOrderItems';

/**
 * How the work given on a job order is going (the owner's view): for each
 * value given to people (on each item), each person's step, % / hold
 * reason, start, time left and history. Nothing when no work was given.
 *
 * @param {Object} props
 * @param {Array} props.items - The job order's items as saved
 */
const WorkProgress = ({ items }) => {
  const now = useNow();
  const given = items.flatMap((item, index) => item.masters.flatMap((master) => master.values
    .filter((value) => value.assignedTo?.length > 0)
    .map((value) => ({ key: `${item._id}-${value.valueId}`, itemLabel: itemLabelOf(item, index, items.length), master, value }))));
  if (given.length === 0) return null;

  return (
    <ul className="divide-y divide-gray-100">
      {given.map(({ key, itemLabel, master, value }) => (
        <li key={key} className="py-3 first:pt-0 last:pb-0">
          <p className="text-sm">
            <span className="font-medium text-gray-900 break-words">{value.name}</span>
            <span className="ml-2 text-xs text-gray-500 break-words">{master.name}</span>
            {itemLabel && <span className="ml-2 text-xs text-indigo-600 break-words">{itemLabel}</span>}
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
