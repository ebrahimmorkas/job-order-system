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
import { ViewIcon, EditIcon, TrashIcon, PlusIcon } from '../../../components/common/ActionIcons';
import { useToast } from '../../../components/common/Toast';
import { useDebouncedValue } from '../../../utils/useDebouncedValue';
import { rangeStateOf, describeRange } from '../accessDates';
import * as usersApi from '../api/usersApi';
import { useAccess } from '../../access/hooks/useAccess';

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

// A role on the list: indigo while it works today, amber before it starts,
// grey once ended or while the role itself is inactive.
const RoleChip = ({ entry, today }) => {
  const state = entry.roleStatus === 'A' ? rangeStateOf(entry, today) : 'inactive';
  const variant = { current: 'blue', upcoming: 'yellow', ended: 'gray', inactive: 'gray' }[state];
  const note = { current: '', upcoming: ' (not started)', ended: ' (ended)', inactive: ' (role inactive)' }[state];
  return (
    <Badge variant={variant} size="sm">
      <span title={`${describeRange(entry, today)}${note}`} className={state === 'ended' || state === 'inactive' ? 'line-through' : undefined}>
        {entry.roleName || 'Role'}
      </span>
    </Badge>
  );
};

/**
 * The vendor's users (never the owner): search, filter by role and status,
 * page through, edit, activate / deactivate and delete (one or several).
 *
 * @param {Object} props
 * @param {() => void} props.onCreate
 * @param {(id: string) => void} props.onView - Details (read only)
 * @param {(id: string) => void} props.onEdit
 */
const UsersListPage = ({ onCreate, onView, onEdit }) => {
  const toast = useToast();
  // What the person may do here (the owner: everything).
  const { can } = useAccess();
  const mayCreate = can('users', 'create');
  const mayEdit = can('users', 'edit');
  const mayDetails = can('users', 'details');
  // The name opens the edit screen, or the details (read only).
  const openRow = mayEdit ? onEdit : mayDetails ? onView : null;
  const mayDelete = can('users', 'delete');
  const { access } = useAccess();
  // A user can't deactivate or delete their own account.
  const isMe = (user) => user._id === access.userId;
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());
  const [status, setStatus] = useState('all');
  const [roleId, setRoleId] = useState('all');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [roleOptions, setRoleOptions] = useState([]);

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  // The request whose answer is on screen; loading while it differs from the current one.
  const [loadedKey, setLoadedKey] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [bulkAction, setBulkAction] = useState(null);
  const [toDelete, setToDelete] = useState(null); // { ids, label }
  const [isDeleting, setIsDeleting] = useState(false);

  // The role filter's choices.
  useEffect(() => {
    let cancelled = false;
    usersApi
      .getFormData()
      .then(({ roles }) => !cancelled && setRoleOptions(roles.map((role) => ({ value: role._id, label: role.name }))))
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // A new search or filter starts again from page 1.
  const [lastQuery, setLastQuery] = useState({ debouncedSearch, status, roleId });
  if (lastQuery.debouncedSearch !== debouncedSearch || lastQuery.status !== status || lastQuery.roleId !== roleId) {
    setLastQuery({ debouncedSearch, status, roleId });
    setPage(1);
  }

  const requestKey = `${debouncedSearch}|${status}|${roleId}|${page}|${reloadKey}`;
  const isLoading = loadedKey !== requestKey;

  useEffect(() => {
    const controller = new AbortController();
    const key = `${debouncedSearch}|${status}|${roleId}|${page}|${reloadKey}`;
    usersApi
      .listUsers({
        search: debouncedSearch,
        status: status === 'all' ? undefined : status,
        roleId: roleId === 'all' ? undefined : roleId,
        page,
        limit: PAGE_SIZE,
      }, { signal: controller.signal })
      .then((result) => {
        // The last user on a later page was deleted: show the page before.
        if (result.users.length === 0 && page > 1) return setPage(page - 1);
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
  }, [debouncedSearch, status, roleId, page, reloadKey]);

  const reload = () => setReloadKey((n) => n + 1);

  const limits = data?.limits;
  const isLimited = limits && limits.usersAllowed !== null;
  const isFull = isLimited && limits.usersUsed >= limits.usersAllowed;
  const isFiltered = debouncedSearch !== '' || status !== 'all' || roleId !== 'all';
  const firstIndex = data ? (data.pagination.page - 1) * data.pagination.limit : 0;

  const toggleStatus = async (user) => {
    setBusyId(user._id);
    try {
      const isActive = user.status !== 'A';
      await usersApi.setUserStatus(user._id, isActive);
      toast.success(`"${user.name}" ${isActive ? 'marked as active' : 'marked as inactive'}.`);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const runBulk = async (action, ids) => {
    const result = await usersApi.bulkUpdateUsers(action, ids);
    if (result.failureCount === 0) {
      toast.success(`${result.successCount} ${result.successCount === 1 ? 'user' : 'users'} ${BULK_LABELS[action]}.`);
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
        await usersApi.deleteUser(toDelete.ids[0]);
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
      render: (user) => <span className="text-gray-500">{firstIndex + data.users.indexOf(user) + 1}</span>,
    },
    {
      key: 'name',
      label: 'Name',
      render: (user) => (
        <div className="min-w-0">
          {openRow ? (
            <button type="button" onClick={() => openRow(user._id)} className="font-medium text-gray-900 hover:text-indigo-600 text-left break-words cursor-pointer">
              {user.name}
            </button>
          ) : (
            <span className="font-medium text-gray-900 break-words">{user.name}</span>
          )}
          <p className="text-xs text-gray-500 break-all">@{user.username}</p>
        </div>
      ),
    },
    {
      key: 'contact',
      label: 'Contact',
      render: (user) => (
        <div className="text-sm text-gray-600 break-all">
          {user.email && <p>{user.email}</p>}
          {user.phone && <p>{user.phone}</p>}
          {!user.email && !user.phone && <span className="text-gray-300">—</span>}
        </div>
      ),
    },
    {
      key: 'roles',
      label: 'Roles',
      render: (user) => (
        <div className="flex flex-wrap items-center gap-1">
          {user.assignedRoles.map((entry) => <RoleChip key={entry.roleId} entry={entry} today={data.today} />)}
          {user.extraAccessCount > 0 && <Badge variant="purple" size="sm">+{user.extraAccessCount} extra</Badge>}
          {user.assignedRoles.length === 0 && user.extraAccessCount === 0 && <span className="text-sm text-amber-700">No access yet</span>}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '90px',
      render: (user) => {
        const isActive = user.status === 'A';
        return (
          <Switch
            size="sm"
            checked={isActive}
            onChange={() => toggleStatus(user)}
            disabled={!mayEdit || isMe(user) || busyId === user._id}
            aria-label={`"${user.name}" ${isActive ? 'is active' : 'is inactive'}`}
            title={isActive ? 'Active' : 'Inactive'}
          />
        );
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      width: '100px',
      render: (user) => {
        const isBusy = busyId === user._id;
        return (
          <div className="flex justify-end gap-0.5">
            {!mayEdit && mayDetails && <IconButton label={`View "${user.name}"`} icon={ViewIcon} onClick={() => onView(user._id)} />}
            {mayEdit && <IconButton label={`Edit "${user.name}"`} icon={EditIcon} onClick={() => onEdit(user._id)} disabled={isBusy} />}
            {mayDelete && !isMe(user) && <IconButton label={`Delete "${user.name}"`} icon={TrashIcon} variant="danger" onClick={() => setToDelete({ ids: [user._id], label: user.name })} disabled={isBusy} />}
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
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          {isLimited && (
            <UsagePill used={limits.usersUsed} allowed={limits.usersAllowed} title={`${limits.usersUsed} of ${limits.usersAllowed} users used`} />
          )}
        </div>
        {mayCreate && (
          <Button leftIcon={<PlusIcon className="w-4 h-4" />} onClick={onCreate} disabled={!limits || isFull}>
            New user
          </Button>
        )}
      </div>

      {isFull && <Alert variant="info">You have reached your limit of {limits.usersAllowed} users. Delete one you no longer need to add another.</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name, username, email or phone"
          ariaLabel="Search users"
          className="!mb-0 flex-1"
        />
        {roleOptions.length > 0 && (
          <div className="sm:w-48">
            <Dropdown options={[{ value: 'all', label: 'All roles' }, ...roleOptions]} value={roleId} onChange={(value) => setRoleId(value)} searchable aria-label="Filter by role" />
          </div>
        )}
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
            mayDelete && { key: 'delete', label: `Delete (${selectedCount})`, variant: 'danger', onClick: () => setToDelete({ ids: selectedKeys, label: `${selectedCount} users` }), disabled: bulkAction !== null },
          ].filter(Boolean)}
        />
      )}

      <Table
        columns={columns}
        data={data?.users || []}
        keyField="_id"
        selectable={mayEdit || mayDelete}
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        loading={isLoading && !data}
        pageSize={null}
        hoverable
        emptyComponent={
          <EmptyState
            title={isFiltered ? 'No users match' : 'No users yet'}
            description={isFiltered ? 'Try another search or filter.' : 'Add a user and give them roles from Role Master.'}
            size="sm"
          />
        }
        caption="Users"
      />

      {data && data.pagination.totalPages > 1 && (
        <Pagination currentPage={page} totalPages={data.pagination.totalPages} onPageChange={setPage} disabled={isLoading} />
      )}

      <ConfirmDialog
        isOpen={!!toDelete}
        title={toDelete?.ids.length > 1 ? `Delete ${toDelete.ids.length} users?` : 'Delete user?'}
        message={toDelete && <>“{toDelete.label}” will be removed for good. Their username can then be used again.</>}
        confirmLabel="Delete"
        loading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
};

export default UsersListPage;
