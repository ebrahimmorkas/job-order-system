import { useEffect, useState } from 'react';
import Table from '../../../components/common/tables';
import Alert from '../../../components/common/Alert';
import SearchInput from '../../../components/common/SearchInput';
import Pagination from '../../../components/common/Pagination';
import BulkActionBar from '../../../components/common/BulkActionBar';
import EmptyState from '../../../components/common/EmptyState';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import IconButton from '../../../components/common/IconButton';
import { ViewIcon, EditIcon, TrashIcon } from '../../../components/common/ActionIcons';
import { useToast } from '../../../components/common/Toast';
import { useDebouncedValue } from '../../../utils/useDebouncedValue';
import * as customersApi from '../api/customersApi';
import { useAccess } from '../../access/hooks/useAccess';

const PAGE_SIZE = 25;

const formatDate = (value) => new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// What a customer is called on screen: their name, else their phone or email.
const titleOf = (customer) => customer.name || customer.phone || customer.email;

/**
 * The customers saved from job orders, latest job order first: search, page
 * through, view, edit and delete (one or several). No create button.
 *
 * @param {Object} props
 * @param {(id: string) => void} props.onView - Details (read only)
 * @param {(id: string) => void} props.onEdit
 */
const CustomersListPage = ({ onView, onEdit }) => {
  const toast = useToast();
  // What the person may do here (the owner: everything).
  const { can } = useAccess();
  const mayEdit = can('customers', 'edit');
  const mayDetails = can('customers', 'details');
  const mayDelete = can('customers', 'delete');
  // The name opens the edit screen, or the details (read only).
  const openRow = mayEdit ? onEdit : mayDetails ? onView : null;
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  // The request whose answer is on screen; loading while it differs from the current one.
  const [loadedKey, setLoadedKey] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [toDelete, setToDelete] = useState(null); // { ids, label }
  const [isDeleting, setIsDeleting] = useState(false);

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
    customersApi
      .listCustomers({ search: debouncedSearch, page, limit: PAGE_SIZE }, { signal: controller.signal })
      .then((result) => {
        // The last customer on a later page was deleted: show the page before.
        if (result.customers.length === 0 && page > 1) return setPage(page - 1);
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
  }, [debouncedSearch, page, reloadKey]);

  const reload = () => setReloadKey((n) => n + 1);

  const isFiltered = debouncedSearch !== '';
  const firstIndex = data ? (data.pagination.page - 1) * data.pagination.limit : 0;

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      if (toDelete.ids.length === 1) {
        await customersApi.deleteCustomer(toDelete.ids[0]);
        toast.success(`"${toDelete.label}" deleted.`);
      } else {
        const result = await customersApi.bulkDeleteCustomers(toDelete.ids);
        if (result.failureCount === 0) {
          toast.success(`${result.successCount} ${result.successCount === 1 ? 'customer' : 'customers'} deleted.`);
        } else {
          toast.warning(`${result.successCount} deleted, ${result.failureCount} could not be deleted. ${result.results.find((r) => !r.isSuccess)?.message || ''}`);
        }
      }
      reload();
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
      render: (customer) => <span className="text-gray-500">{firstIndex + data.customers.indexOf(customer) + 1}</span>,
    },
    {
      key: 'name',
      label: 'Name',
      render: (customer) => {
        const title = customer.name || <span className="text-gray-400">No name</span>;
        return openRow ? (
          <button type="button" onClick={() => openRow(customer._id)} className="font-medium text-gray-900 hover:text-indigo-600 text-left break-words cursor-pointer">
            {title}
          </button>
        ) : (
          <span className="font-medium text-gray-900 break-words">{title}</span>
        );
      },
    },
    {
      key: 'contact',
      label: 'Contact',
      render: (customer) => (
        <div className="text-sm text-gray-600 break-all">
          {customer.phone && <p>{customer.phone}</p>}
          {customer.email && <p>{customer.email}</p>}
        </div>
      ),
    },
    {
      key: 'place',
      label: 'Place',
      render: ({ address }) => {
        const place = [address?.cityName, address?.stateName, address?.countryName].filter(Boolean).join(', ');
        return place ? <span className="text-sm text-gray-600 break-words">{place}</span> : <span className="text-gray-300">—</span>;
      },
    },
    {
      key: 'jobOrderCount',
      label: 'Job orders',
      align: 'right',
      width: '100px',
      render: (customer) => <span className="text-gray-700">{customer.jobOrderCount}</span>,
    },
    {
      key: 'lastJobOrderAt',
      label: 'Last job order',
      width: '130px',
      render: (customer) => (customer.lastJobOrderAt
        ? <span className="whitespace-nowrap text-gray-600">{formatDate(customer.lastJobOrderAt)}</span>
        : <span className="text-gray-300">—</span>),
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      width: '100px',
      render: (customer) => (
        <div className="flex justify-end gap-0.5">
          {!mayEdit && mayDetails && <IconButton label={`View "${titleOf(customer)}"`} icon={ViewIcon} onClick={() => onView(customer._id)} />}
          {mayEdit && <IconButton label={`Edit "${titleOf(customer)}"`} icon={EditIcon} onClick={() => onEdit(customer._id)} />}
          {mayDelete && <IconButton label={`Delete "${titleOf(customer)}"`} icon={TrashIcon} variant="danger" onClick={() => setToDelete({ ids: [customer._id], label: titleOf(customer) })} />}
        </div>
      ),
    },
  ];

  const selectedCount = selectedKeys.length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <p className="mt-1 text-sm text-gray-500">Saved from job orders with a phone or an email.</p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search by name, phone, email or address"
        ariaLabel="Search customers"
      />

      {selectedCount > 0 && mayDelete && (
        <BulkActionBar
          selectedCount={selectedCount}
          onClear={() => setSelectedKeys([])}
          actions={[
            { key: 'delete', label: `Delete (${selectedCount})`, variant: 'danger', onClick: () => setToDelete({ ids: selectedKeys, label: `${selectedCount} customers` }) },
          ]}
        />
      )}

      <Table
        columns={columns}
        data={data?.customers || []}
        keyField="_id"
        selectable={mayDelete}
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        loading={isLoading && !data}
        pageSize={null}
        hoverable
        emptyComponent={
          <EmptyState
            title={isFiltered ? 'No customers match' : 'No customers yet'}
            description={isFiltered ? 'Try another search.' : 'A job order with a customer phone or email saves the customer here.'}
            size="sm"
          />
        }
        caption="Customers"
      />

      {data && data.pagination.totalPages > 1 && (
        <Pagination currentPage={page} totalPages={data.pagination.totalPages} onPageChange={setPage} disabled={isLoading} />
      )}

      <ConfirmDialog
        isOpen={!!toDelete}
        title={toDelete?.ids.length > 1 ? `Delete ${toDelete.ids.length} customers?` : 'Delete customer?'}
        message={toDelete && <>“{toDelete.label}” will be removed from Customers. Job orders already saved keep their details.</>}
        confirmLabel="Delete"
        loading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
};

export default CustomersListPage;
