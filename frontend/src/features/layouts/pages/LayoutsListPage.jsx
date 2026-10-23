import { useEffect, useState } from 'react';
import Table from '../../../components/common/tables';
import Button from '../../../components/common/Buttons';
import Switch from '../../../components/common/Switch';
import Badge from '../../../components/common/Badge';
import Alert from '../../../components/common/Alert';
import Dropdown from '../../../components/common/DropDown';
import SearchInput from '../../../components/common/SearchInput';
import Pagination from '../../../components/common/Pagination';
import BulkActionBar from '../../../components/common/BulkActionBar';
import EmptyState from '../../../components/common/EmptyState';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import IconButton from '../../../components/common/IconButton';
import UsagePill from '../../../components/common/UsagePill';
import { EditIcon, CopyIcon, TrashIcon, PlusIcon, StarIcon } from '../../../components/common/ActionIcons';
import { useToast } from '../../../components/common/Toast';
import { useDebouncedValue } from '../../../utils/useDebouncedValue';
import { describePaper } from '../layoutConstants';
import * as layoutsApi from '../api/layoutsApi';

const PAGE_SIZE = 25;

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'A', label: 'Active' },
  { value: 'I', label: 'Inactive' },
];

const BULK_LABELS = {
  activate: 'marked as active',
  deactivate: 'marked as inactive',
  delete: 'deleted',
};

/**
 * The vendor's print layouts: search, filter by status, page through, edit,
 * copy, make one the default, activate / deactivate and delete (one or several).
 *
 * @param {Object} props
 * @param {() => void} props.onCreate
 * @param {(id: string) => void} props.onEdit
 * @param {(id: string) => void} props.onClone
 */
const LayoutsListPage = ({ onCreate, onEdit, onClone }) => {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  // The request whose answer is on screen; loading while it differs from the current one.
  const [loadedKey, setLoadedKey] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [bulkAction, setBulkAction] = useState(null);
  const [toDelete, setToDelete] = useState(null); // { ids, label }
  const [isDeleting, setIsDeleting] = useState(false);

  // A new search or filter starts again from page 1.
  const [lastQuery, setLastQuery] = useState({ debouncedSearch, status });
  if (lastQuery.debouncedSearch !== debouncedSearch || lastQuery.status !== status) {
    setLastQuery({ debouncedSearch, status });
    setPage(1);
  }

  const requestKey = `${debouncedSearch}|${status}|${page}|${reloadKey}`;
  const isLoading = loadedKey !== requestKey;

  useEffect(() => {
    const controller = new AbortController();
    const key = `${debouncedSearch}|${status}|${page}|${reloadKey}`;
    layoutsApi
      .listLayouts({
        search: debouncedSearch,
        status: status === 'all' ? undefined : status,
        page,
        limit: PAGE_SIZE,
      }, { signal: controller.signal })
      .then((result) => {
        // The last layout on a later page was deleted: show the page before.
        if (result.layouts.length === 0 && page > 1) return setPage(page - 1);
        setData(result);
        setError('');
        setSelectedKeys([]);
        setLoadedKey(key);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setError(err.message);
        setLoadedKey(key);
      });
    return () => controller.abort();
  }, [debouncedSearch, status, page, reloadKey]);

  const reload = () => setReloadKey((n) => n + 1);

  const limits = data?.limits;
  const isLimited = limits && limits.layoutsAllowed !== null;
  const isFull = isLimited && limits.layoutsUsed >= limits.layoutsAllowed;
  const isFiltered = debouncedSearch !== '' || status !== 'all';
  const firstIndex = data ? (data.pagination.page - 1) * data.pagination.limit : 0;

  const runOne = async (layout, request, message) => {
    setBusyId(layout._id);
    try {
      await request();
      toast.success(message);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const toggleStatus = (layout) => {
    const isActive = layout.status !== 'A';
    return runOne(layout, () => layoutsApi.setLayoutStatus(layout._id, isActive), `"${layout.name}" ${isActive ? 'marked as active' : 'marked as inactive'}.`);
  };

  const makeDefault = (layout) =>
    runOne(layout, () => layoutsApi.setDefaultLayout(layout._id), `"${layout.name}" is now picked first when printing.`);

  const runBulk = async (action, ids) => {
    const result = await layoutsApi.bulkUpdateLayouts(action, ids);
    if (result.failureCount === 0) {
      toast.success(`${result.successCount} ${result.successCount === 1 ? 'layout' : 'layouts'} ${BULK_LABELS[action]}.`);
    } else {
      toast.warning(`${result.successCount} ${BULK_LABELS[action]}, ${result.failureCount} could not be changed. ${result.results.find((r) => !r.isSuccess)?.message || ''}`);
    }
    reload();
  };

  const handleBulkStatus = async (action) => {
    setBulkAction(action);
    try {
      await runBulk(action, selectedKeys);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBulkAction(null);
    }
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      if (toDelete.ids.length === 1) {
        await layoutsApi.deleteLayout(toDelete.ids[0]);
        toast.success(`"${toDelete.label}" deleted.`);
        reload();
      } else {
        await runBulk('delete', toDelete.ids);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsDeleting(false);
      setToDelete(null);
    }
  };

  const columns = [
    {
      key: 'srNo',
      label: 'Sr. No.',
      width: '80px',
      render: (layout) => <span className="text-gray-500">{firstIndex + data.layouts.indexOf(layout) + 1}</span>,
    },
    {
      key: 'name',
      label: 'Name',
      render: (layout) => (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => onEdit(layout._id)} className="font-medium text-gray-900 hover:text-indigo-600 text-left break-words cursor-pointer">
            {layout.name}
          </button>
          {layout.isDefault && <Badge variant="purple" size="sm">Default</Badge>}
        </div>
      ),
    },
    {
      key: 'paper',
      label: 'Paper',
      width: '190px',
      render: (layout) => <span className="text-sm text-gray-600">{describePaper(layout.paper)}</span>,
    },
    {
      key: 'items',
      label: 'Items',
      width: '80px',
      render: (layout) => <span className={`text-sm ${layout.elementsCount === 0 ? 'text-amber-700' : 'text-gray-600'}`}>{layout.elementsCount}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      width: '90px',
      render: (layout) => {
        const isActive = layout.status === 'A';
        return (
          <Switch
            size="sm"
            checked={isActive}
            onChange={() => toggleStatus(layout)}
            disabled={busyId === layout._id}
            aria-label={`"${layout.name}" ${isActive ? 'is active' : 'is inactive'}`}
            title={isActive ? 'Active' : 'Inactive'}
          />
        );
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      width: '170px',
      render: (layout) => {
        const isBusy = busyId === layout._id;
        const canBeDefault = !layout.isDefault && layout.status === 'A';
        return (
          <div className="flex justify-end gap-0.5">
            <IconButton
              label={layout.isDefault ? `"${layout.name}" is the default` : (canBeDefault ? `Make "${layout.name}" the default` : 'Only an active layout can be the default')}
              icon={StarIcon}
              onClick={() => makeDefault(layout)}
              disabled={isBusy || !canBeDefault}
            />
            <IconButton label={`Edit "${layout.name}"`} icon={EditIcon} onClick={() => onEdit(layout._id)} disabled={isBusy} />
            <IconButton
              label={isFull ? 'Copy - the layouts limit is reached' : `Copy "${layout.name}"`}
              icon={CopyIcon}
              onClick={() => onClone(layout._id)}
              disabled={isBusy || isFull}
            />
            <IconButton label={`Delete "${layout.name}"`} icon={TrashIcon} variant="danger" onClick={() => setToDelete({ ids: [layout._id], label: layout.name })} disabled={isBusy} />
          </div>
        );
      },
    },
  ];

  const selectedCount = selectedKeys.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Layout Master</h1>
          {isLimited && (
            <UsagePill used={limits.layoutsUsed} allowed={limits.layoutsAllowed} title={`${limits.layoutsUsed} of ${limits.layoutsAllowed} layouts used`} />
          )}
        </div>
        <Button leftIcon={<PlusIcon className="w-4 h-4" />} onClick={onCreate} disabled={!limits || isFull}>
          New layout
        </Button>
      </div>

      <p className="text-sm text-gray-500">Design how a job order looks on paper. The default layout is picked first when printing a job order.</p>

      {isFull && <Alert variant="info">You have reached your limit of {limits.layoutsAllowed} layouts. Delete one you no longer need to add another.</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name"
          ariaLabel="Search layouts"
          className="!mb-0 flex-1"
        />
        <div className="sm:w-44">
          <Dropdown options={STATUS_OPTIONS} value={status} onChange={(value) => setStatus(value)} aria-label="Filter by status" />
        </div>
      </div>

      {selectedCount > 0 && (
        <BulkActionBar
          selectedCount={selectedCount}
          onClear={() => setSelectedKeys([])}
          actions={[
            { key: 'activate', label: `Mark active (${selectedCount})`, variant: 'outline', onClick: () => handleBulkStatus('activate'), loading: bulkAction === 'activate', disabled: bulkAction !== null },
            { key: 'deactivate', label: `Mark inactive (${selectedCount})`, variant: 'outline', onClick: () => handleBulkStatus('deactivate'), loading: bulkAction === 'deactivate', disabled: bulkAction !== null },
            { key: 'delete', label: `Delete (${selectedCount})`, variant: 'danger', onClick: () => setToDelete({ ids: selectedKeys, label: `${selectedCount} layouts` }), disabled: bulkAction !== null },
          ]}
        />
      )}

      <Table
        columns={columns}
        data={data?.layouts || []}
        keyField="_id"
        selectable
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        loading={isLoading && !data}
        pageSize={null}
        hoverable
        emptyComponent={
          <EmptyState
            title={isFiltered ? 'No layouts match' : 'No layouts yet'}
            description={isFiltered ? 'Try another search or filter.' : 'Create a layout: pick the paper, then drag the job order fields, masters, controls and shapes onto it.'}
            size="sm"
          />
        }
        caption="Layouts"
      />

      {data && data.pagination.totalPages > 1 && (
        <Pagination currentPage={page} totalPages={data.pagination.totalPages} onPageChange={setPage} disabled={isLoading} />
      )}

      <ConfirmDialog
        isOpen={!!toDelete}
        title={toDelete?.ids.length > 1 ? `Delete ${toDelete.ids.length} layouts?` : 'Delete layout?'}
        message={toDelete && <>“{toDelete.label}” will be removed for good.</>}
        confirmLabel="Delete"
        loading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
};

export default LayoutsListPage;
