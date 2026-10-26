import { useEffect, useState } from 'react';
import { useRealtimeEvent } from '../../realtime/hooks/useRealtimeEvent';
import { REALTIME_EVENTS } from '../../realtime/events';
import Table from '../../../components/common/tables';
import Button from '../../../components/common/Buttons';
import Badge from '../../../components/common/Badge';
import Alert from '../../../components/common/Alert';
import SearchInput from '../../../components/common/SearchInput';
import Pagination from '../../../components/common/Pagination';
import EmptyState from '../../../components/common/EmptyState';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import Modal from '../../../components/common/Modal';
import IconButton from '../../../components/common/IconButton';
import { ViewIcon, EditIcon, PrintIcon, TrashIcon, PlusIcon } from '../../../components/common/ActionIcons';
import { useToast } from '../../../components/common/Toast';
import { useDebouncedValue } from '../../../utils/useDebouncedValue';
import { useAccess } from '../../access/hooks/useAccess';
import { formatMoney } from '../jobOrderTotals';
import StepBadge from '../components/StepBadge';
import StepChanger from '../../myWork/components/StepChanger';
import * as jobOrdersApi from '../api/jobOrdersApi';

const PAGE_SIZE = 25;

const formatDate = (value) => new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

/**
 * The vendor's job orders, newest first: search by number, customer
 * (name, phone, email) or place, page through, view, print, edit and cancel (each only with its
 * permission; print also needs Layout Master). With steps on, Edit can move a
 * job order's own step from its row ("Change step" opens a popup).
 *
 * @param {Object} props
 * @param {() => void} props.onCreate
 * @param {(id: string) => void} props.onView
 * @param {(id: string) => void} props.onEdit
 * @param {((id: string) => void)|null} props.onPrint - null while Layout Master is off
 */
const JobOrdersListPage = ({ onCreate, onView, onEdit, onPrint }) => {
  const toast = useToast();
  const { can } = useAccess();
  const canCreate = can('jobOrders', 'create');
  const canEdit = can('jobOrders', 'edit');
  const canOpen = can('jobOrders', 'details');
  const canCancel = can('jobOrders', 'delete');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  // The request whose answer is on screen; loading while it differs from the current one.
  const [loadedKey, setLoadedKey] = useState(null);
  const [toCancel, setToCancel] = useState(null); // the job order
  const [isCancelling, setIsCancelling] = useState(false);
  const [stepOf, setStepOf] = useState(null); // the job order whose step is being changed

  // A new search starts again from page 1.
  const [lastSearch, setLastSearch] = useState(debouncedSearch);
  if (lastSearch !== debouncedSearch) {
    setLastSearch(debouncedSearch);
    setPage(1);
  }

  const requestKey = `${debouncedSearch}|${page}|${reloadKey}`;
  const isLoading = loadedKey !== requestKey;

  useEffect(() => {
    const controller = new AbortController();
    const key = `${debouncedSearch}|${page}|${reloadKey}`;
    jobOrdersApi
      .listJobOrders({ search: debouncedSearch, page, limit: PAGE_SIZE }, { signal: controller.signal })
      .then((result) => {
        // The last job order on a later page was cancelled: show the page before.
        if (result.jobOrders.length === 0 && page > 1) return setPage(page - 1);
        setData(result);
        setError('');
        setLoadedKey(key);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setError(err.message);
        setLoadedKey(key);
      });
    return () => controller.abort();
  }, [debouncedSearch, page, reloadKey]);

  // A job order created, saved or its work moved (by anyone): load again.
  useRealtimeEvent([REALTIME_EVENTS.JOB_ORDERS_CHANGED, REALTIME_EVENTS.RECONNECTED], () => setReloadKey((n) => n + 1));

  const confirmCancel = async () => {
    setIsCancelling(true);
    try {
      await jobOrdersApi.cancelJobOrder(toCancel._id);
      toast.success(`Job order ${toCancel.jobOrderNumber} cancelled.`);
      setReloadKey((n) => n + 1);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsCancelling(false);
      setToCancel(null);
    }
  };

  const columns = [
    {
      key: 'jobOrderNumber',
      label: 'Job order no.',
      width: '160px',
      render: (jobOrder) => (canOpen ? (
        <button type="button" onClick={() => onView(jobOrder._id)} className="font-medium text-gray-900 hover:text-indigo-600 text-left break-all cursor-pointer">
          {jobOrder.jobOrderNumber}
        </button>
      ) : (
        <span className="font-medium text-gray-900 break-all">{jobOrder.jobOrderNumber}</span>
      )),
    },
    {
      key: 'jobNames',
      label: 'Job name',
      // One item: its name. Several: each on its own line, numbered by item
      // ("2. -" for an item without a name).
      render: ({ jobNames = [] }) => {
        if (!jobNames.some(Boolean)) return <span className="text-gray-400">-</span>;
        if (jobNames.length === 1) return <p className="min-w-32 break-words text-gray-900">{jobNames[0]}</p>;
        return (
          <div className="min-w-32 break-words text-gray-900">
            {jobNames.map((name, index) => <p key={index}>{index + 1}. {name || <span className="text-gray-400">-</span>}</p>)}
          </div>
        );
      },
    },
    {
      key: 'customer',
      label: 'Customer',
      render: ({ customer }) => {
        const who = [customer?.name, customer?.phone].filter(Boolean).join(' · ');
        const place = [customer?.cityName, customer?.stateName, customer?.countryName].filter(Boolean).join(', ');
        if (!who && !place) return <span className="text-gray-400">-</span>;
        return (
          <div className="min-w-0 break-words">
            {who && <p className="text-gray-900">{who}</p>}
            {place && <p className={who ? 'text-xs text-gray-500' : undefined}>{place}</p>}
          </div>
        );
      },
    },
    {
      key: 'total',
      label: 'Total',
      align: 'right',
      width: '170px',
      render: (jobOrder) => (
        <span className="inline-flex flex-col items-end">
          <span className="font-medium text-gray-900 tabular-nums whitespace-nowrap">{formatMoney(jobOrder.total, jobOrder.currency)}</span>
          {jobOrder.tax?.isApplied && <span className="text-xs text-gray-500 tabular-nums whitespace-nowrap">incl. tax {formatMoney(jobOrder.tax.amount, jobOrder.currency)}</span>}
          {jobOrder.balance !== null && jobOrder.balance !== undefined && (
            <span className="text-xs font-medium text-indigo-700 tabular-nums whitespace-nowrap">balance {formatMoney(jobOrder.balance, jobOrder.currency)}</span>
          )}
        </span>
      ),
    },
    // Only when some job order on this page has a delivery date.
    ...(data?.jobOrders?.some((jobOrder) => jobOrder.deliveryAt) ? [{
      key: 'deliveryAt',
      label: 'Delivery',
      width: '130px',
      render: ({ deliveryAt }) => (deliveryAt ? <span className="whitespace-nowrap text-gray-700">{formatDate(deliveryAt)}</span> : <span className="text-gray-400">-</span>),
    }] : []),
    // The job order's own step (only while steps are on).
    ...(data?.isStepsOn ? [{
      key: 'step',
      label: 'Step',
      width: '130px',
      render: (jobOrder) => (
        <div className="flex flex-col items-start gap-1">
          <StepBadge step={jobOrder.step} />
          {canEdit && data.steps?.length > 0 && (
            <button
              type="button"
              onClick={() => setStepOf(jobOrder)}
              aria-label={`Change step for ${jobOrder.jobOrderNumber}`}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 cursor-pointer"
            >
              Change step
            </button>
          )}
        </div>
      ),
    }] : []),
    {
      key: 'work',
      label: 'Work',
      width: '150px',
      render: ({ work }) => (work ? (
        <span className="inline-flex flex-col gap-0.5 text-xs">
          <span className={work.completed === work.people ? 'font-medium text-green-700' : 'text-gray-700'}>{work.completed} of {work.people} done</span>
          {work.onHold > 0 && <span className="text-amber-700">{work.onHold} on hold</span>}
          {work.started > 0 && <span className="text-gray-500">{work.started} working</span>}
        </span>
      ) : <span className="text-gray-400">-</span>),
    },
    {
      key: 'createdAt',
      label: 'Created',
      width: '130px',
      render: (jobOrder) => <span className="whitespace-nowrap text-gray-600">{formatDate(jobOrder.createdAt)}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      width: '160px',
      render: (jobOrder) => (
        <div className="flex justify-end gap-0.5">
          {canOpen && <IconButton label={`View ${jobOrder.jobOrderNumber}`} icon={ViewIcon} onClick={() => onView(jobOrder._id)} />}
          {canOpen && onPrint && <IconButton label={`Print ${jobOrder.jobOrderNumber}`} icon={PrintIcon} onClick={() => onPrint(jobOrder._id)} />}
          {canEdit && <IconButton label={`Edit ${jobOrder.jobOrderNumber}`} icon={EditIcon} onClick={() => onEdit(jobOrder._id)} />}
          {canCancel && <IconButton label={`Cancel ${jobOrder.jobOrderNumber}`} icon={TrashIcon} variant="danger" onClick={() => setToCancel(jobOrder)} />}
        </div>
      ),
    },
  ];

  const total = data?.pagination.total ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Job Orders</h1>
          {data && <Badge variant="gray" size="sm">{total} {total === 1 ? 'job order' : 'job orders'}</Badge>}
        </div>
        {canCreate && (
          <Button leftIcon={<PlusIcon className="w-4 h-4" />} onClick={onCreate}>
            New job order
          </Button>
        )}
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search by number, job name, customer or place"
        ariaLabel="Search job orders"
        className="!mb-0"
      />

      <Table
        columns={columns}
        data={data?.jobOrders || []}
        keyField="_id"
        loading={isLoading && !data}
        pageSize={null}
        hoverable
        emptyComponent={
          <EmptyState
            title={debouncedSearch ? 'No job orders match' : 'No job orders yet'}
            description={debouncedSearch ? 'Try another search.' : canCreate ? 'Create your first job order.' : 'Job orders will show here.'}
            size="sm"
          />
        }
        caption="Job orders"
      />

      {data && data.pagination.totalPages > 1 && (
        <Pagination currentPage={page} totalPages={data.pagination.totalPages} onPageChange={setPage} disabled={isLoading} />
      )}

      <ConfirmDialog
        isOpen={!!toCancel}
        title="Cancel job order?"
        message={toCancel && <>Job order {toCancel.jobOrderNumber} will be removed from this list.</>}
        confirmLabel="Cancel job order"
        loading={isCancelling}
        onConfirm={confirmCancel}
        onCancel={() => setToCancel(null)}
      />

      <Modal isOpen={!!stepOf} onClose={() => setStepOf(null)} title={stepOf ? `Step of ${stepOf.jobOrderNumber}` : ''} size="sm">
        {stepOf && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              Now: <StepBadge step={stepOf.step} />
            </div>
            <p className="text-xs text-gray-500">The step of the whole job order. The workers' own steps don't change.</p>
            <StepChanger
              jobOrderId={stepOf._id}
              work={{ itemId: 'jobOrder', valueId: stepOf._id, valueName: `Job order ${stepOf.jobOrderNumber}`, step: stepOf.step }}
              steps={data?.steps || []}
              onSave={(stepData) => jobOrdersApi.setJobOrderStep(stepOf._id, stepData)}
              onChanged={() => { setStepOf(null); setReloadKey((n) => n + 1); }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default JobOrdersListPage;
