import { useToast } from '../../../components/common/Toast';
import { NotFoundPage } from '../../../components/errors';
import { useRouter, screenOf } from '../../../router';
import { useAccess } from '../../access/hooks/useAccess';
import CustomersListPage from './CustomersListPage';
import CustomerFormPage from './CustomerFormPage';

/**
 * The Customers section: the list (/customers), details (/customers/:id, read
 * only) or the edit screen (/customers/:id/edit). No create: customers are
 * saved from job orders.
 *
 * @param {Object} props
 * @param {string} props.basePath - '/customers'
 * @param {string[]} props.segments - The address after it
 */
const CustomersPage = ({ basePath, segments }) => {
  const toast = useToast();
  const { navigate } = useRouter();
  const { can } = useAccess();
  const screen = screenOf(segments, { view: true, actions: { edit: 'edit' } });

  const backToList = () => navigate(basePath);

  if (!screen || screen.mode === 'create') return <NotFoundPage embedded onGoHome={() => navigate('/')} />;

  if (screen.mode === 'list') {
    return (
      <CustomersListPage
        onView={(id) => navigate(`${basePath}/${id}`)}
        onEdit={(id) => navigate(`${basePath}/${id}/edit`)}
      />
    );
  }

  return (
    <CustomerFormPage
      // A fresh form for every customer / mode.
      key={`${screen.mode}-${screen.id}`}
      readOnly={screen.mode === 'view'}
      onEdit={can('customers', 'edit') ? () => navigate(`${basePath}/${screen.id}/edit`) : null}
      customerId={screen.id}
      onBack={backToList}
      onDone={(message) => {
        toast.success(message);
        backToList();
      }}
    />
  );
};

export default CustomersPage;
