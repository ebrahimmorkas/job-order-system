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
import { EditIcon, CopyIcon, TrashIcon, PlusIcon } from '../../../components/common/ActionIcons';
import { useToast } from '../../../components/common/Toast';
import { useDebouncedValue } from '../../../utils/useDebouncedValue';
import { ROLE_TYPES, MODULE_LABELS } from '../roleTypes';
import * as rolesApi from '../api/rolesApi';

const PAGE_SIZE = 25;
// How many modules / masters a row names before "+N more".
const ACCESS_SHOWN = 3;

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'A', label: 'Active' },
  { value: 'I', label: 'Inactive' },
];

const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  ...Object.entries(ROLE_TYPES).map(([value, { label }]) => ({ value, label })),
];

const BULK_LABELS = {
  activate: 'marked as active',
  deactivate: 'marked as inactive',
  delete: 'deleted',
};

// What a role gives, in words: "Job Orders, Masters" or "Cutting: Round cutting".
const accessOf = (role) =>
  role.type === 'module'
    ? role.modules.map((entry) => MODULE_LABELS[entry.module] || entry.module)
    : role.masters.map((entry) => `${entry.masterName || 'Master'}: ${entry.isWholeMaster ? 'all values' : entry.valueNames.join(', ')}`);

/**
 * The vendor's roles: search, filter by status and type, page through, edit,
 * copy, activate / deactivate and delete (one or several).
 *
 * @param {Object} props
 * @param {() => void} props.onCreate
 * @param {(id: string) => void} props.onEdit
 * @param {(id: string) => void} props.onClone
 */
const RolesListPage = ({ onCreate, onEdit, onClone }) => {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
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
  const [lastQuery, setLastQuery] = useState({ debouncedSearch, status, type });
  if (lastQuery.debouncedSearch !== debouncedSearch || lastQuery.status !== status || lastQuery.type !== type) {
    setLastQuery({ debouncedSearch, status, type });
    setPage(1);
  }

  const requestKey = `${debouncedSearch}|${status}|${type}|${page}|${reloadKey}`;
  const isLoading = loadedKey !== requestKey;

  useEffect(() => {
    const controller = new AbortController();
    const key = `${debouncedSearch}|${status}|${type}|${page}|${reloadKey}`;
    rolesApi
      .listRoles({
        search: debouncedSearch,
        status: status === 'all' ? undefined : status,
        type: type === 'all' ? undefined : type,
        page,
        limit: PAGE_SIZE,
      }, { signal: controller.signal })
      .then((result) => {
        // The last role on a later page was deleted: show the page before.
        if (result.roles.length === 0 && page > 1) return setPage(page - 1);
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
  }, [debouncedSearch, status, type, page, reloadKey]);

  const reload = () => setReloadKey((n) => n + 1);

  const limits = data?.limits;
  const isLimited = limits && limits.rolesAllowed !== null;
  const isFull = isLimited && limits.rolesUsed >= limits.rolesAllowed;
  const isFiltered = debouncedSearch !== '' || status !== 'all' || type !== 'all';
  const firstIndex = data ? (data.pagination.page - 1) * data.pagination.limit : 0;

  const toggleStatus = async (role) => {
    setBusyId(role._id);
    try {
      const isActive = role.status !== 'A';
      await rolesApi.setRoleStatus(role._id, isActive);
      toast.success(`"${role.name}" ${isActive ? 'marked as active' : 'marked as inactive'}.`);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const runBulk = async (action, ids) => {
    const result = await rolesApi.bulkUpdateRoles(action, ids);
    if (result.failureCount === 0) {
      toast.success(`${result.successCount} ${result.successCount === 1 ? 'role' : 'roles'} ${BULK_LABELS[action]}.`);
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
        await rolesApi.deleteRole(toDelete.ids[0]);
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
      render: (role) => <span className="text-gray-500">{firstIndex + data.roles.indexOf(role) + 1}</span>,
    },
    {
      key: 'name',
      label: 'Name',
      render: (role) => (
        <button type="button" onClick={() => onEdit(role._id)} className="font-medium text-gray-900 hover:text-indigo-600 text-left break-words cursor-pointer">
          {role.name}
        </button>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      width: '130px',
      render: (role) => <Badge variant={role.type === 'module' ? 'blue' : 'purple'} size="sm">{ROLE_TYPES[role.type].label}</Badge>,
    },
    {
      key: 'access',
      label: 'Access',
      render: (role) => {
        const access = accessOf(role);
        if (access.length === 0) return <span className="text-sm text-amber-700">Nothing yet - edit to add</span>;
        const more = access.length - ACCESS_SHOWN;
        return (
          <span className="text-sm text-gray-600 break-words" title={access.join('\n')}>
            {access.slice(0, ACCESS_SHOWN).join(role.type === 'module' ? ', ' : '; ')}
            {more > 0 && <span className="ml-1 text-gray-400">+{more} more</span>}
          </span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      width: '90px',
      render: (role) => {
        const isActive = role.status === 'A';
        return (
          <Switch
            size="sm"
            checked={isActive}
            onChange={() => toggleStatus(role)}
            disabled={busyId === role._id}
            aria-label={`"${role.name}" ${isActive ? 'is active' : 'is inactive'}`}
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
      render: (role) => {
        const isBusy = busyId === role._id;
        return (
          <div className="flex justify-end gap-0.5">
            <IconButton label={`Edit "${role.name}"`} icon={EditIcon} onClick={() => onEdit(role._id)} disabled={isBusy} />
            <IconButton
              label={isFull ? 'Copy - the roles limit is reached' : `Copy "${role.name}"`}
              icon={CopyIcon}
              onClick={() => onClone(role._id)}
              disabled={isBusy || isFull}
            />
            <IconButton label={`Delete "${role.name}"`} icon={TrashIcon} variant="danger" onClick={() => setToDelete({ ids: [role._id], label: role.name })} disabled={isBusy} />
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
          <h1 className="text-2xl font-bold text-gray-900">Role Master</h1>
          {isLimited && (
            <UsagePill used={limits.rolesUsed} allowed={limits.rolesAllowed} title={`${limits.rolesUsed} of ${limits.rolesAllowed} roles used`} />
          )}
        </div>
        <Button leftIcon={<PlusIcon className="w-4 h-4" />} onClick={onCreate} disabled={!limits || isFull}>
          New role
        </Button>
      </div>

      {isFull && <Alert variant="info">You have reached your limit of {limits.rolesAllowed} roles. Delete one you no longer need to add another.</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name"
          ariaLabel="Search roles"
          className="!mb-0 flex-1"
        />
        <div className="sm:w-44">
          <Dropdown options={TYPE_OPTIONS} value={type} onChange={(value) => setType(value)} aria-label="Filter by type" />
        </div>
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
            { key: 'delete', label: `Delete (${selectedCount})`, variant: 'danger', onClick: () => setToDelete({ ids: selectedKeys, label: `${selectedCount} roles` }), disabled: bulkAction !== null },
          ]}
        />
      )}

      <Table
        columns={columns}
        data={data?.roles || []}
        keyField="_id"
        selectable
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        loading={isLoading && !data}
        pageSize={null}
        hoverable
        emptyComponent={
          <EmptyState
            title={isFiltered ? 'No roles match' : 'No roles yet'}
            description={isFiltered ? 'Try another search or filter.' : 'Create a role, e.g. "Office staff" with Job Orders, or "Round cutter" with one value of a master.'}
            size="sm"
          />
        }
        caption="Roles"
      />

      {data && data.pagination.totalPages > 1 && (
        <Pagination currentPage={page} totalPages={data.pagination.totalPages} onPageChange={setPage} disabled={isLoading} />
      )}

      <ConfirmDialog
        isOpen={!!toDelete}
        title={toDelete?.ids.length > 1 ? `Delete ${toDelete.ids.length} roles?` : 'Delete role?'}
        message={toDelete && <>“{toDelete.label}” will be removed for good.</>}
        confirmLabel="Delete"
        loading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
};

export default RolesListPage;
