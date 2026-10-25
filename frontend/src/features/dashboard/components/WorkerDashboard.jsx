import { useEffect, useState } from 'react';
import Card from '../../../components/common/Card';
import Alert from '../../../components/common/Alert';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Buttons';
import Skeleton from '../../../components/common/Skeleton';
import StepBadge from '../../jobOrders/components/StepBadge';
import { formatDueAt, timeStatusOf } from '../../jobOrders/workTime';
import { useNow } from '../../../utils/useNow';
import { useRouter } from '../../../router';
import { useRealtimeEvent } from '../../realtime/hooks/useRealtimeEvent';
import { REALTIME_EVENTS } from '../../realtime/events';
import StatTile from './StatTile';
import * as dashboardApi from '../api/dashboardApi';

/**
 * A user's own dashboard (given work): how much of their work is where, and
 * what is due next. Loads again by itself when their work changes.
 */
const WorkerDashboard = () => {
  const { navigate } = useRouter();
  const now = useNow();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    dashboardApi.getMySummary({ signal: controller.signal })
      .then((result) => {
        setData(result);
        setError('');
      })
      .catch((err) => err?.name !== 'AbortError' && setError(err.message));
    return () => controller.abort();
  }, [reloadKey]);

  useRealtimeEvent([REALTIME_EVENTS.MY_WORK_CHANGED, REALTIME_EVENTS.RECONNECTED], () => setReloadKey((n) => n + 1));

  if (error && !data) return <Alert variant="error">{error}</Alert>;
  if (!data) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-busy="true">
        {[0, 1, 2, 3].map((key) => <Skeleton key={key} variant="rect" height="7rem" className="rounded-xl" />)}
      </div>
    );
  }

  const { totals, next } = data;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Your open work" value={totals.open} hint={`${totals.notStarted} not started yet`} onClick={() => navigate('/my-work')} />
        <StatTile label="In progress" value={totals.inProgress} tone="blue" />
        <StatTile label="Overdue" value={totals.overdue} hint={totals.onHold > 0 ? `${totals.onHold} on hold` : 'Nothing on hold'} tone={totals.overdue > 0 ? 'red' : 'gray'} />
        <StatTile label="Completed this week" value={totals.completedThisWeek} tone="green" />
      </div>

      <Card
        variant="outlined"
        title="Due next"
        subtitle="Your open work, overdue first"
        headerActions={<Button size="sm" variant="outline" onClick={() => navigate('/my-work')}>Open My work</Button>}
      >
        {next.length === 0 && <p className="py-6 text-center text-sm text-gray-500">All done - no open work.</p>}
        <ul className="divide-y divide-gray-100">
          {next.map((item) => {
            const status = timeStatusOf(item, now);
            return (
              <li key={`${item.jobOrderId}-${item.itemId}-${item.valueId}`}>
                <button type="button" onClick={() => navigate(`/my-work/${item.jobOrderId}`)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 py-3 text-left hover:bg-gray-50 cursor-pointer">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-gray-900 break-words">{item.valueName} <span className="text-xs font-normal text-gray-500">{item.masterName}</span>{item.itemLabel && <> <span className="text-xs font-normal text-indigo-600">{item.itemLabel}</span></>}</span>
                    <span className="block text-xs text-gray-500">{item.jobOrderNumber}{item.dueAt ? ` · due ${formatDueAt(item.dueAt)}` : ''}</span>
                  </span>
                  <StepBadge step={item.step} />
                  <Badge variant={status.variant} size="sm">{status.text}</Badge>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
};

export default WorkerDashboard;
