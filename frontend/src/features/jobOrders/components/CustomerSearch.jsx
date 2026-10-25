import { useEffect, useState } from 'react';
import Autocomplete from '../../../components/common/Autocomplete';
import { useDebouncedValue } from '../../../utils/useDebouncedValue';
import * as customersApi from '../../customers/api/customersApi';

// "Ravi Kumar · 9876543210 · ravi@mail.com · Pune": what a saved customer shows as.
const describe = (customer) =>
  [customer.name, customer.phone, customer.email, customer.address?.cityName].filter(Boolean).join(' · ');

/**
 * Finds a saved customer by any part of their name, phone, email or address;
 * picking one hands them to onPick (the form fills in their details).
 *
 * @param {Object} props
 * @param {(customer: Object) => void} props.onPick
 * @param {boolean} [props.disabled]
 */
const CustomerSearch = ({ onPick, disabled = false }) => {
  const [text, setText] = useState('');
  const search = useDebouncedValue(text.trim());
  const [found, setFound] = useState({ search: '', customers: [] });

  useEffect(() => {
    if (!search) return undefined;
    const controller = new AbortController();
    customersApi
      .searchForJobOrder(search, { signal: controller.signal })
      .then(({ customers }) => setFound({ search, customers }))
      .catch(() => setFound({ search, customers: [] }));
    return () => controller.abort();
  }, [search]);

  const customers = search && found.search === search ? found.customers : [];

  return (
    <Autocomplete
      label="Find a saved customer"
      name="customerSearch"
      placeholder="Type a name, phone, email or address"
      value={text}
      onChange={setText}
      options={customers.map((customer) => ({ value: customer._id, label: describe(customer) }))}
      // The server already matched them.
      filterFn={() => true}
      minChars={1}
      loading={!!text.trim() && found.search !== search}
      noOptionsText="No saved customer matches"
      onSelect={(option) => {
        onPick(customers.find((customer) => customer._id === option.value));
        setText('');
      }}
      helperText="Or fill in the details below: a new phone or email is saved as a new customer."
      disabled={disabled}
    />
  );
};

export default CustomerSearch;
