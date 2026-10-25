import { useEffect, useState } from 'react';
import Card from '../../../components/common/Card';
import Alert from '../../../components/common/Alert';
import Badge from '../../../components/common/Badge';
import Table from '../../../components/common/tables';
import EmptyState from '../../../components/common/EmptyState';
import Skeleton from '../../../components/common/Skeleton';
import StepBadge from '../../jobOrders/components/StepBadge';
import { formatDueAt, timeStatusOf } from '../../jobOrders/workTime';
import { useNow } from '../../../utils/useNow';
import { useRouter } from '../../../router';
import { useAccess } from '../../access/hooks/useAccess';
import { useRealtimeEvent } from '../../realtime/hooks/useRealtimeEvent';
import { REALTIME_EVENTS } from '../../realtime/events';
import StatTile from './StatTile';
import WorkloadChart from './WorkloadChart';
import * as dashboardApi from '../api/dashboardApi';

const formatDate = (value) => new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const timeAgoOf = (value, now) => {
  const minutes = Math.floor((now - new Date(value).getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h ago`;
  return formatDueAt(value);
};

/**
 * The owner's dashboard (also a user's with Dashboard): numbers across the
 * top, who is working on what (most urgent first, time left counting down),
 * each person's workload and the latest step changes. It loads again by
 * itself whenever a job order or its work changes.
 */
const OwnerDashboard = () => {
  const { navigate } = useRouter();
  const { can } = useAccess();
  const now = useNow();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  // Opening a job order needs Job Orders Details.
  const canOpen = can('jobOrders', 'details');
  const openJobOrder = canOpen ? (id) => navigate(`/job-orders/${id}`) : null;

  useEffect(() => {
    const controller = new AbortController();
    dashboardApi.getDashboard({ signal: controller.signal })
      .then((result) => {
        setData(result);
        setError('');
      })
      .catch((err) => err?.name !== 'AbortError' && setError(err.message));
    return () => controller.abort();
  }, [reloadKey]);

  useRealtimeEvent([REALTIME_EVENTS.JOB_ORDERS_CHANGED, REALTIME_EVENTS.RECONNECTED], () => setReloadKey((n) => n + 1));

  if (error && !data) return <Alert variant="error">{error}</Alert>;
  if (!data) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((key) => <Skeleton key={key} variant="rect" height="7rem" className="rounded-xl" />)}
        </div>
        <Skeleton variant="rect" height="18rem" className="rounded-xl" />
      </div>
    );
  }

  const { totals } = data;
  const jobOrderLink = (item) => (openJobOrder
    ? <button type="button" onClick={() => openJobOrder(item.jobOrderId)} className="font-medium text-gray-900 hover:text-indigo-600 text-left break-all cursor-pointer">{item.jobOrderNumber}</button>
    : <span className="font-medium text-gray-900 break-all">{item.jobOrderNumber}</span>);

  const columns = [
    { key: 'userName', label: 'Person', render: (item) => <span className="font-medium text-gray-900 break-words">{item.userName}</span> },
    { key: 'jobOrderNumber', label: 'Job order', width: '130px', render: jobOrderLink },
    {
      key: 'work',
      label: 'Work',
      render: (item) => (
        <span className="break-words">
          <span className="text-gray-900">{item.valueName}</span> <span className="text-xs text-gray-500">{item.masterName}</span>
          {item.itemLabel && <> <span className="text-xs text-indigo-600">{item.itemLabel}</span></>}
        </span>
      ),
    },
    { key: 'step', label: 'Step', render: (item) => <StepBadge step={item.step} /> },
    {
      key: 'startedAt',
      label: 'Started',
      width: '130px',
      render: (item) => (item.startedAt
        ? <span className="whitespace-nowrap text-gray-600">{formatDate(item.startedAt)}</span>
        : <span className="text-gray-400">Not yet</span>),
    },
    {
      key: 'timeLeft',
      label: 'Time left',
      render: (item) => {
        const status = timeStatusOf(item, now);
        return (
          <div className="space-y-0.5">
            <Badge variant={status.variant} size="sm">{status.text}</Badge>
            {item.dueAt && <p className="whitespace-nowrap text-xs text-gray-500">Due {formatDueAt(item.dueAt)}</p>}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Open job orders" value={totals.jobOrders} hint={`${totals.createdThisWeek} new this week`} onClick={can('jobOrders', 'view') ? () => navigate('/job-orders') : undefined} />
        <StatTile label="Work in progress" value={totals.inProgress} hint={`${totals.notStarted} not started yet`} tone="blue" />
        <StatTile label="Overdue" value={totals.overdue} hint={totals.onHold > 0 ? `${totals.onHold} on hold` : 'Nothing on hold'} tone={totals.overdue > 0 ? 'red' : 'gray'} />
        <StatTile label="Completed this week" value={totals.completedThisWeek} hint={`${totals.open} still open`} tone="green" />
      </div>

      <Card variant="outlined" title="Who is working on what" subtitle={data.workingTotal > data.working.length ? `The ${data.working.length} most urgent of ${data.workingTotal} - overdue first, then the soonest due.` : 'Overdue first, then the soonest due.'}>
        <Table
          columns={columns}
          data={data.working}
          getRowKey={(item) => `${item.jobOrderId}-${item.itemId}-${item.valueId}-${item.userId}`}
          pageSize={null}
          hoverable
          emptyComponent={<EmptyState title="Nobody has open work" description="Work given on job orders shows here until it is completed." size="sm" />}
        />
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card variant="outlined" title="Workload" subtitle="Open work per person" className="lg:col-span-3">
          {data.workload.length > 0
            ? <WorkloadChart workload={data.workload} moreCount={data.workloadTotal - data.workload.length} />
            : <p className="py-6 text-center text-sm text-gray-500">No open work.</p>}
        </Card>
        <Card variant="outlined" title="Latest activity" subtitle="Step changes in the last 14 days" className="lg:col-span-2">
          {data.activity.length === 0 && <p className="py-6 text-center text-sm text-gray-500">No step changes yet.</p>}
          <ol className="space-y-4">
            {data.activity.map((entry, index) => (
              <li key={`${entry.jobOrderId}-${entry.at}-${index}`} className="flex gap-3">
                <span className="mt-0.5 shrink-0"><StepBadge step={entry.step} /></span>
                <div className="min-w-0 text-sm">
                  <p className="text-gray-900 break-words">
                    <span className="font-medium">{entry.userName}</span> · {entry.valueName}{entry.itemLabel && ` (${entry.itemLabel})`} on {openJobOrder
                      ? <button type="button" onClick={() => openJobOrder(entry.jobOrderId)} className="font-medium text-indigo-600 hover:text-indigo-800 cursor-pointer">{entry.jobOrderNumber}</button>
                      : entry.jobOrderNumber}
                  </p>
                  {entry.step.holdReason && <p className="text-xs text-gray-600 break-words">On hold: {entry.step.holdReason}</p>}
                  <p className="text-xs text-gray-400">{timeAgoOf(entry.at, now)}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
};

export default OwnerDashboard;
