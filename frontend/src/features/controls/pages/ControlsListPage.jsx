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
import { ViewIcon, EditIcon, CopyIcon, TrashIcon, PlusIcon, MoveUpIcon, MoveDownIcon } from '../../../components/common/ActionIcons';
import { useToast } from '../../../components/common/Toast';
import { useDebouncedValue } from '../../../utils/useDebouncedValue';
import { CONTROL_TYPES, isTypeFull } from '../controlTypes';
import * as controlsApi from '../api/controlsApi';
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

/**
 * The vendor's controls (fields on the job order form): search, filter by
 * status and type, page through, edit, copy, activate / deactivate and
 * delete (one or several), and move them up / down (the order on the job order).
 *
 * @param {Object} props
 * @param {(limits: Object) => void} props.onCreate
 * @param {(id: string) => void} props.onView - Details (read only)
 * @param {(id: string) => void} props.onEdit
 * @param {(id: string) => void} props.onClone
 */
const ControlsListPage = ({ onCreate, onView, onEdit, onClone }) => {
  const toast = useToast();
  // What the person may do here (the owner: everything).
  const { can } = useAccess();
  const mayCreate = can('controls', 'create');
  const mayEdit = can('controls', 'edit');
  const mayDetails = can('controls', 'details');
  // The name opens the edit screen, or the details (read only).
  const openRow = mayEdit ? onEdit : mayDetails ? onView : null;
  const mayDelete = can('controls', 'delete');
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
    controlsApi
      .listControls({
        search: debouncedSearch,
        status: status === 'all' ? undefined : status,
        type: type === 'all' ? undefined : type,
        page,
        limit: PAGE_SIZE,
      }, { signal: controller.signal })
      .then((result) => {
        // The last control on a later page was deleted: show the page before.
        if (result.controls.length === 0 && page > 1) return setPage(page - 1);
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
  const assignedTypes = limits?.assignedTypes || [];
  const canCreate = assignedTypes.some((t) => !isTypeFull(limits, t));
  const isFiltered = debouncedSearch !== '' || status !== 'all' || type !== 'all';
  const limitedTypes = assignedTypes.filter((t) => limits.controlsAllowed[t] !== null);
  // Tax is charged on a price only while tax is available to the vendor.
  const isTaxed = (control) => control.isPriceIncludedInTax && limits?.isTaxAvailable === true;

  const toggleStatus = async (control) => {
    setBusyId(control._id);
    try {
      const isActive = control.status !== 'A';
      await controlsApi.setControlStatus(control._id, isActive);
      toast.success(`"${control.label}" ${isActive ? 'marked as active' : 'marked as inactive'}.`);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const move = async (control, direction) => {
    setBusyId(control._id);
    try {
      await controlsApi.moveControl(control._id, direction);
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
  const rowIndex = new Map((data?.controls || []).map((control, i) => [control._id, firstIndex + i]));

  const runBulk = async (action, ids) => {
    const result = await controlsApi.bulkUpdateControls(action, ids);
    if (result.failureCount === 0) {
      toast.success(`${result.successCount} ${result.successCount === 1 ? 'control' : 'controls'} ${BULK_LABELS[action]}.`);
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
        await controlsApi.deleteControl(toDelete.ids[0]);
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
      render: (control) => {
        const index = rowIndex.get(control._id);
        const isBusy = busyId !== null;
        return (
          <div className="flex items-center gap-1">
            <span className="w-7 text-gray-500">{index + 1}</span>
            {/* Moving only makes sense when the whole list is shown in order. */}
            {!isFiltered && mayEdit && (
              <div className="flex">
                <IconButton label={`Move "${control.label}" up`} icon={MoveUpIcon} size="sm" onClick={() => move(control, 'up')} disabled={isBusy || index === 0} />
                <IconButton label={`Move "${control.label}" down`} icon={MoveDownIcon} size="sm" onClick={() => move(control, 'down')} disabled={isBusy || index === total - 1} />
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'label',
      label: 'Label',
      render: (control) => (
        <div className="min-w-0">
          {openRow ? (
            <button type="button" onClick={() => openRow(control._id)} className="font-medium text-gray-900 hover:text-indigo-600 text-left break-words cursor-pointer">
              {control.label}
            </button>
          ) : (
            <span className="font-medium text-gray-900 break-words">{control.label}</span>
          )}
          {control.optionsCount !== null && <span className="ml-2 text-xs text-gray-500">{control.optionsCount} choices</span>}
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      width: '140px',
      render: (control) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <Badge variant="blue" size="sm">{CONTROL_TYPES[control.type].label}</Badge>
          {control.isPrice && (isTaxed(control) ? <Badge variant="green" size="sm">Price + tax</Badge> : <Badge variant="gray" size="sm">Price</Badge>)}
        </span>
      ),
    },
    {
      key: 'isRequired',
      label: 'Required',
      width: '100px',
      render: (control) => (control.isRequired ? 'Yes' : 'No'),
    },
    {
      key: 'status',
      label: 'Status',
      width: '90px',
      render: (control) => {
        const isActive = control.status === 'A';
        return (
          <Switch
            size="sm"
            checked={isActive}
            onChange={() => toggleStatus(control)}
            disabled={!mayEdit || busyId === control._id}
            aria-label={`"${control.label}" ${isActive ? 'is active' : 'is inactive'}`}
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
      render: (control) => {
        const isBusy = busyId === control._id;
        const isFull = isTypeFull(limits, control.type);
        return (
          <div className="flex justify-end gap-0.5">
            {!mayEdit && mayDetails && <IconButton label={`View "${control.label}"`} icon={ViewIcon} onClick={() => onView(control._id)} />}
            {mayEdit && <IconButton label={`Edit "${control.label}"`} icon={EditIcon} onClick={() => onEdit(control._id)} disabled={isBusy} />}
            {mayCreate && (
              <IconButton
                label={isFull ? `Copy - the limit for ${CONTROL_TYPES[control.type].plural.toLowerCase()} is reached` : `Copy "${control.label}"`}
                icon={CopyIcon}
                onClick={() => onClone(control._id)}
                disabled={isBusy || isFull}
              />
            )}
            {mayDelete && <IconButton label={`Delete "${control.label}"`} icon={TrashIcon} variant="danger" onClick={() => setToDelete({ ids: [control._id], label: control.label })} disabled={isBusy} />}
          </div>
        );
      },
    },
  ];

  const selectedCount = selectedKeys.length;
  const typeOptions = [{ value: 'all', label: 'All types' }, ...assignedTypes.map((t) => ({ value: t, label: CONTROL_TYPES[t].label }))];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Controls</h1>
          {limitedTypes.map((t) => (
            <UsagePill
              key={t}
              used={limits.controlsUsed[t]}
              allowed={limits.controlsAllowed[t]}
              label={CONTROL_TYPES[t].plural.toLowerCase()}
              title={`${limits.controlsUsed[t]} of ${limits.controlsAllowed[t]} ${CONTROL_TYPES[t].plural.toLowerCase()} used`}
            />
          ))}
        </div>
        {mayCreate && (
          <Button leftIcon={<PlusIcon className="w-4 h-4" />} onClick={() => onCreate(limits)} disabled={!canCreate}>
            New control
          </Button>
        )}
      </div>

      {limits && !canCreate && <Alert variant="info">You have reached your limit for every type of control. Delete one you no longer need to add another.</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by label"
          ariaLabel="Search controls"
          className="!mb-0 flex-1"
        />
        {assignedTypes.length > 1 && (
          <div className="sm:w-44">
            <Dropdown options={typeOptions} value={type} onChange={(value) => setType(value)} aria-label="Filter by type" />
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
            mayDelete && { key: 'delete', label: `Delete (${selectedCount})`, variant: 'danger', onClick: () => setToDelete({ ids: selectedKeys, label: `${selectedCount} controls` }), disabled: bulkAction !== null },
          ].filter(Boolean)}
        />
      )}

      <Table
        columns={columns}
        data={data?.controls || []}
        keyField="_id"
        selectable={mayEdit || mayDelete}
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        loading={isLoading && !data}
        pageSize={null}
        hoverable
        emptyComponent={
          <EmptyState
            title={isFiltered ? 'No controls match' : 'No controls yet'}
            description={isFiltered ? 'Try another search or filter.' : 'Create a control, e.g. a "Vehicle number" text field or an "Urgent delivery" checkbox.'}
            size="sm"
          />
        }
        caption="Controls"
      />

      {data && data.pagination.totalPages > 1 && (
        <Pagination currentPage={page} totalPages={data.pagination.totalPages} onPageChange={setPage} disabled={isLoading} />
      )}

      <ConfirmDialog
        isOpen={!!toDelete}
        title={toDelete?.ids.length > 1 ? `Delete ${toDelete.ids.length} controls?` : 'Delete control?'}
        message={toDelete && <>“{toDelete.label}” will no longer appear on new job orders.</>}
        confirmLabel="Delete"
        loading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
};

export default ControlsListPage;
