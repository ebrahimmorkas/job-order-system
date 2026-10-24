import { useEffect, useState } from 'react';
import Table from '../../../components/common/tables';
import Button from '../../../components/common/Buttons';
import Switch from '../../../components/common/Switch';
import Alert from '../../../components/common/Alert';
import Dropdown from '../../../components/common/DropDown';
import SearchInput from '../../../components/common/SearchInput';
import Pagination from '../../../components/common/Pagination';
import BulkActionBar from '../../../components/common/BulkActionBar';
import EmptyState from '../../../components/common/EmptyState';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import { useToast } from '../../../components/common/Toast';
import { useDebouncedValue } from '../../../utils/useDebouncedValue';
import IconButton from '../../../components/common/IconButton';
import UsagePill from '../../../components/common/UsagePill';
import { ViewIcon, EditIcon, CopyIcon, TrashIcon, PlusIcon, MoveUpIcon, MoveDownIcon } from '../../../components/common/ActionIcons';
import MasterValuesModal from '../components/MasterValuesModal';
import { useAccess } from '../../access/hooks/useAccess';
import * as mastersApi from '../api/mastersApi';

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
 * The vendor's masters: search, filter by status, page through, edit,
 * clone, activate / deactivate and delete (one or several), see a master's
 * values, and move masters up / down (the order on the job order).
 *
 * @param {Object} props
 * @param {(limits: Object) => void} props.onCreate
 * @param {(id: string) => void} props.onView - Details (read only)
 * @param {(id: string) => void} props.onEdit
 * @param {(id: string) => void} props.onClone
 */
const MastersListPage = ({ onCreate, onView, onEdit, onClone }) => {
  const toast = useToast();
  // What the person may do here (the owner: everything).
  const { can } = useAccess();
  const mayCreate = can('masters', 'create');
  const mayEdit = can('masters', 'edit');
  const mayDetails = can('masters', 'details');
  // The name opens the edit screen, or the details (read only).
  const openRow = mayEdit ? onEdit : mayDetails ? onView : null;
  const mayDelete = can('masters', 'delete');
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
  const [valuesOf, setValuesOf] = useState(null); // the master whose values popup is open

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
    mastersApi
      .listMasters({ search: debouncedSearch, status: status === 'all' ? undefined : status, page, limit: PAGE_SIZE }, { signal: controller.signal })
      .then((result) => {
        // The last master on a later page was deleted: show the page before.
        if (result.masters.length === 0 && page > 1) return setPage(page - 1);
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
  const isNotSetUp = limits && (limits.mastersAllowed === null || limits.valuesAllowedPerMaster === null);
  const isFull = limits && !isNotSetUp && limits.mastersUsed >= limits.mastersAllowed;
  const canCreate = limits && !isNotSetUp && !isFull;
  const isFiltered = debouncedSearch !== '' || status !== 'all';

  const toggleStatus = async (master) => {
    setBusyId(master._id);
    try {
      const isActive = master.status !== 'A';
      await mastersApi.setMasterStatus(master._id, isActive);
      toast.success(`"${master.name}" ${isActive ? 'marked as active' : 'marked as inactive'}.`);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const move = async (master, direction) => {
    setBusyId(master._id);
    try {
      await mastersApi.moveMaster(master._id, direction);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  // Position of each row in the whole list (Sr. No. and the first / last check).
  const firstIndex = data ? (data.pagination.page - 1) * data.pagination.limit : 0;
  const total = data?.pagination.total || 0;
  const rowIndex = new Map((data?.masters || []).map((master, i) => [master._id, firstIndex + i]));

  const runBulk = async (action, ids) => {
    const result = await mastersApi.bulkUpdateMasters(action, ids);
    if (result.failureCount === 0) {
      toast.success(`${result.successCount} ${result.successCount === 1 ? 'master' : 'masters'} ${BULK_LABELS[action]}.`);
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
        await mastersApi.deleteMaster(toDelete.ids[0]);
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
      width: '100px',
      render: (master) => {
        const index = rowIndex.get(master._id);
        const isBusy = busyId !== null;
        return (
          <div className="flex items-center gap-1">
            <span className="w-7 text-gray-500">{index + 1}</span>
            {/* Moving only makes sense when the whole list is shown in order. */}
            {!isFiltered && mayEdit && (
              <div className="flex">
                <IconButton label={`Move "${master.name}" up`} icon={MoveUpIcon} size="sm" onClick={() => move(master, 'up')} disabled={isBusy || index === 0} />
                <IconButton label={`Move "${master.name}" down`} icon={MoveDownIcon} size="sm" onClick={() => move(master, 'down')} disabled={isBusy || index === total - 1} />
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'name',
      label: 'Name',
      render: (master) => (
        <div className="min-w-0">
          {openRow ? (
            <button type="button" onClick={() => openRow(master._id)} className="font-medium text-gray-900 hover:text-indigo-600 text-left break-words cursor-pointer">
              {master.name}
            </button>
          ) : (
            <span className="font-medium text-gray-900 break-words">{master.name}</span>
          )}
          {master.shortName && <span className="ml-2 text-xs text-gray-500">{master.shortName}</span>}
        </div>
      ),
    },
    {
      key: 'valuesCount',
      label: 'Values',
      align: 'center',
      width: '90px',
      render: (master) => (
        <button
          type="button"
          onClick={() => setValuesOf(master)}
          aria-label={`See the ${master.valuesCount} values of "${master.name}"`}
          title="See values"
          className="min-w-8 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium hover:bg-indigo-100 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          {master.valuesCount}
        </button>
      ),
    },
    {
      key: 'isRequired',
      label: 'Required',
      width: '100px',
      render: (master) => (master.isRequired ? 'Yes' : 'No'),
    },
    {
      key: 'isMultiselectAllowed',
      label: 'Multiple selection',
      width: '150px',
      render: (master) => (master.isMultiselectAllowed ? 'Yes' : 'No'),
    },
    {
      key: 'status',
      label: 'Status',
      width: '90px',
      render: (master) => {
        const isActive = master.status === 'A';
        return (
          <Switch
            size="sm"
            checked={isActive}
            onChange={() => toggleStatus(master)}
            disabled={!mayEdit || busyId === master._id}
            aria-label={`"${master.name}" ${isActive ? 'is active' : 'is inactive'}`}
            title={isActive ? 'Active' : 'Inactive'}
          />
        );
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      width: '130px',
      render: (master) => {
        const isBusy = busyId === master._id;
        return (
          <div className="flex justify-end gap-0.5">
            {!mayEdit && mayDetails && <IconButton label={`View "${master.name}"`} icon={ViewIcon} onClick={() => onView(master._id)} />}
            {mayEdit && <IconButton label={`Edit "${master.name}"`} icon={EditIcon} onClick={() => onEdit(master._id)} disabled={isBusy} />}
            {mayCreate && (
              <IconButton
                label={canCreate ? `Copy "${master.name}"` : 'Copy - the limit for masters is reached'}
                icon={CopyIcon}
                onClick={() => onClone(master._id)}
                disabled={isBusy || !canCreate}
              />
            )}
            {mayDelete && <IconButton label={`Delete "${master.name}"`} icon={TrashIcon} variant="danger" onClick={() => setToDelete({ ids: [master._id], label: master.name })} disabled={isBusy} />}
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
          <h1 className="text-2xl font-bold text-gray-900">Masters</h1>
          {limits && !isNotSetUp && (
            <UsagePill used={limits.mastersUsed} allowed={limits.mastersAllowed} title={`${limits.mastersUsed} of ${limits.mastersAllowed} masters used`} />
          )}
        </div>
        {mayCreate && (
          <Button leftIcon={<PlusIcon className="w-4 h-4" />} onClick={() => onCreate(limits)} disabled={!canCreate}>
            New master
          </Button>
        )}
      </div>

      {isNotSetUp && <Alert variant="warning">Masters have not been set up for your account yet. Please contact support.</Alert>}
      {isFull && <Alert variant="info">You have reached your limit of {limits.mastersAllowed} masters. Delete one you no longer need to add another.</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name or short name"
          ariaLabel="Search masters"
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
            mayEdit && { key: 'activate', label: `Mark active (${selectedCount})`, variant: 'outline', onClick: () => handleBulkStatus('activate'), loading: bulkAction === 'activate', disabled: bulkAction !== null },
            mayEdit && { key: 'deactivate', label: `Mark inactive (${selectedCount})`, variant: 'outline', onClick: () => handleBulkStatus('deactivate'), loading: bulkAction === 'deactivate', disabled: bulkAction !== null },
            mayDelete && { key: 'delete', label: `Delete (${selectedCount})`, variant: 'danger', onClick: () => setToDelete({ ids: selectedKeys, label: `${selectedCount} masters` }), disabled: bulkAction !== null },
          ].filter(Boolean)}
        />
      )}

      <Table
        columns={columns}
        data={data?.masters || []}
        keyField="_id"
        selectable={mayEdit || mayDelete}
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        loading={isLoading && !data}
        pageSize={null}
        hoverable
        emptyComponent={
          <EmptyState
            title={isFiltered ? 'No masters match' : 'No masters yet'}
            description={isFiltered ? 'Try another search or status.' : 'Create a master, e.g. "My Services" with values like Polishing and Cutting.'}
            size="sm"
          />
        }
        caption="Masters"
      />

      {data && data.pagination.totalPages > 1 && (
        <Pagination currentPage={page} totalPages={data.pagination.totalPages} onPageChange={setPage} disabled={isLoading} />
      )}

      <ConfirmDialog
        isOpen={!!toDelete}
        title={toDelete?.ids.length > 1 ? `Delete ${toDelete.ids.length} masters?` : 'Delete master?'}
        message={toDelete && <>“{toDelete.label}” and all {toDelete.ids.length > 1 ? 'their' : 'its'} values will no longer be offered on new job orders.</>}
        confirmLabel="Delete"
        loading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />

      {valuesOf && (
        <MasterValuesModal
          master={valuesOf}
          canEdit={mayEdit}
          canDelete={mayDelete}
          onClose={(hasChanged) => {
            setValuesOf(null);
            if (hasChanged) reload();
          }}
        />
      )}
    </div>
  );
};

export default MastersListPage;
