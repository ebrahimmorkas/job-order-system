import { useEffect, useState } from 'react';
import { useRealtimeEvent } from '../../realtime/hooks/useRealtimeEvent';
import { REALTIME_EVENTS } from '../../realtime/events';
import Table from '../../../components/common/tables';
import Badge from '../../../components/common/Badge';
import Alert from '../../../components/common/Alert';
import SearchInput from '../../../components/common/SearchInput';
import Pagination from '../../../components/common/Pagination';
import EmptyState from '../../../components/common/EmptyState';
import IconButton from '../../../components/common/IconButton';
import { ViewIcon } from '../../../components/common/ActionIcons';
import { useDebouncedValue } from '../../../utils/useDebouncedValue';
import { useNow } from '../../../utils/useNow';
import WorkItem from '../components/WorkItem';
import * as myWorkApi from '../api/myWorkApi';

const PAGE_SIZE = 25;

const formatDate = (value) => new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

/**
 * The job orders the user is given work on, newest first: what they do on
 * each and by when. Search by number or customer place, page through, view.
 *
 * @param {Object} props
 * @param {(id: string) => void} props.onView
 */
const MyWorkListPage = ({ onView }) => {
  const now = useNow();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());
  const [page, setPage] = useState(1);

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  // The request whose answer is on screen; loading while it differs from the current one.
  const [loadedKey, setLoadedKey] = useState(null);
  // Bumped when the server says the person's work changed.
  const [reloadKey, setReloadKey] = useState(0);

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
    myWorkApi
      .listMyWork({ search: debouncedSearch, page, limit: PAGE_SIZE }, { signal: controller.signal })
      .then((result) => {
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

  useRealtimeEvent([REALTIME_EVENTS.MY_WORK_CHANGED, REALTIME_EVENTS.RECONNECTED], () => setReloadKey((n) => n + 1));

  const columns = [
    {
      key: 'jobOrderNumber',
      label: 'Job order no.',
      width: '160px',
      render: (jobOrder) => (
        <button type="button" onClick={() => onView(jobOrder._id)} className="font-medium text-gray-900 hover:text-indigo-600 text-left break-all cursor-pointer">
          {jobOrder.jobOrderNumber}
        </button>
      ),
    },
    {
      key: 'work',
      label: 'Your work',
      render: (jobOrder) => (
        <ul className="space-y-3">
          {jobOrder.work.map((work, index) => <li key={index}><WorkItem work={work} now={now} /></li>)}
        </ul>
      ),
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
      key: 'createdAt',
      label: 'Created',
      width: '130px',
      render: (jobOrder) => <span className="whitespace-nowrap text-gray-600">{formatDate(jobOrder.createdAt)}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      width: '90px',
      render: (jobOrder) => (
        <div className="flex justify-end">
          <IconButton label={`View ${jobOrder.jobOrderNumber}`} icon={ViewIcon} onClick={() => onView(jobOrder._id)} />
        </div>
      ),
    },
  ];

  const total = data?.pagination.total ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">My work</h1>
        {data && <Badge variant="gray" size="sm">{total} {total === 1 ? 'job order' : 'job orders'}</Badge>}
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search by number or customer place"
        ariaLabel="Search my work"
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
            title={debouncedSearch ? 'No job orders match' : 'No work given to you yet'}
            description={debouncedSearch ? 'Try another search.' : 'Job orders you are given work on will show here.'}
            size="sm"
          />
        }
        caption="My work"
      />

      {data && data.pagination.totalPages > 1 && (
        <Pagination currentPage={page} totalPages={data.pagination.totalPages} onPageChange={setPage} disabled={isLoading} />
      )}
    </div>
  );
};

export default MyWorkListPage;
