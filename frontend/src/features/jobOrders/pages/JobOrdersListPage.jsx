import { useEffect, useState } from 'react';
import Table from '../../../components/common/tables';
import Button from '../../../components/common/Buttons';
import Badge from '../../../components/common/Badge';
import Alert from '../../../components/common/Alert';
import SearchInput from '../../../components/common/SearchInput';
import Pagination from '../../../components/common/Pagination';
import EmptyState from '../../../components/common/EmptyState';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import IconButton from '../../../components/common/IconButton';
import { ViewIcon, EditIcon, TrashIcon, PlusIcon } from '../../../components/common/ActionIcons';
import { useToast } from '../../../components/common/Toast';
import { useDebouncedValue } from '../../../utils/useDebouncedValue';
import { useAccess } from '../../access/hooks/useAccess';
import { formatMoney } from '../jobOrderTotals';
import * as jobOrdersApi from '../api/jobOrdersApi';

const PAGE_SIZE = 25;

const formatDate = (value) => new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

/**
 * The vendor's job orders, newest first: search by number or customer
 * place, page through, view, edit and cancel (each only with its permission).
 *
 * @param {Object} props
 * @param {() => void} props.onCreate
 * @param {(id: string) => void} props.onView
 * @param {(id: string) => void} props.onEdit
 */
const JobOrdersListPage = ({ onCreate, onView, onEdit }) => {
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
      key: 'customer',
      label: 'Customer place',
      render: ({ customer }) => {
        const place = [customer?.cityName, customer?.stateName, customer?.countryName].filter(Boolean).join(', ');
        return place ? <span className="break-words">{place}</span> : <span className="text-gray-400">-</span>;
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
        </span>
      ),
    },
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
      width: '130px',
      render: (jobOrder) => (
        <div className="flex justify-end gap-0.5">
          {canOpen && <IconButton label={`View ${jobOrder.jobOrderNumber}`} icon={ViewIcon} onClick={() => onView(jobOrder._id)} />}
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
        placeholder="Search by number or customer place"
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
    </div>
  );
};

export default JobOrdersListPage;
