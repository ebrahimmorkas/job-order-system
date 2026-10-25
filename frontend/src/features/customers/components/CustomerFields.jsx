import InputField from '../../../components/common/InputField';
import TextArea from '../../../components/common/TextArea';
import Dropdown from '../../../components/common/DropDown';
import { CUSTOMER_NAME_MAX_LENGTH, CUSTOMER_EMAIL_MAX_LENGTH, CUSTOMER_ADDRESS_MAX_LENGTH, POSTAL_CODE_MAX_LENGTH } from '../customerFields';

/**
 * A customer's name, phone, email and address inputs (customerFields.js
 * shape). Used by the job order form and the customer edit screen.
 *
 * @param {Object} props
 * @param {Object} props.customer - { name, phone, email, countryId, stateId, cityId, postalCode, address }
 * @param {Array} props.countries - The vendor's: { _id, name, states, cities, postalCode }
 * @param {(changes: Object, ...errorKeys: string[]) => void} props.onChange - The error keys to clear
 * @param {Object} props.errors - Error key -> message
 * @param {string} [props.contactPrefix] - Error key prefix of name / phone / email, e.g. 'customer.'
 * @param {string} [props.addressPrefix] - Error key prefix of the address parts, e.g. 'address.'
 * @param {boolean} [props.showContact]
 * @param {boolean} [props.showAddress]
 * @param {boolean} [props.disabled]
 */
const CustomerFields = ({
  customer,
  countries,
  onChange,
  errors,
  contactPrefix = '',
  addressPrefix = '',
  showContact = true,
  showAddress = true,
  disabled = false,
}) => {
  const contactKey = (field) => `${contactPrefix}${field}`;
  const addressKey = (field) => `${addressPrefix}${field}`;
  const country = countries.find((c) => c._id === customer.countryId) || null;
  const stateOptions = (country?.states || []).map((s) => ({ value: s._id, label: s.name }));
  const cityOptions = (country?.cities || []).filter((c) => c.stateId === customer.stateId).map((c) => ({ value: c._id, label: c.name }));

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {showContact && (
        <>
          <div className="sm:col-span-2">
            <InputField
              label="Customer name"
              name="customerName"
              placeholder="e.g. Ravi Kumar"
              value={customer.name}
              onChange={(e) => onChange({ name: e.target.value }, contactKey('name'))}
              error={errors[contactKey('name')]}
              maxLength={CUSTOMER_NAME_MAX_LENGTH}
              disabled={disabled}
            />
          </div>
          <InputField
            label="Phone"
            name="customerPhone"
            type="tel"
            placeholder="e.g. 9876543210"
            value={customer.phone}
            onChange={(e) => onChange({ phone: e.target.value }, contactKey('phone'), contactKey('email'))}
            error={errors[contactKey('phone')]}
            maxLength={14}
            disabled={disabled}
          />
          <InputField
            label="Email"
            name="customerEmail"
            type="email"
            placeholder="e.g. ravi@example.com"
            value={customer.email}
            onChange={(e) => onChange({ email: e.target.value }, contactKey('email'), contactKey('phone'))}
            error={errors[contactKey('email')]}
            maxLength={CUSTOMER_EMAIL_MAX_LENGTH}
            disabled={disabled}
          />
        </>
      )}

      {showAddress && (
        <>
          <Dropdown
            label="Country"
            name="countryId"
            options={countries.map((c) => ({ value: c._id, label: c.name }))}
            value={customer.countryId}
            onChange={(value) => {
              // States and cities belong to one country.
              if ((value || '') === customer.countryId) return;
              onChange({ countryId: value || '', stateId: '', cityId: '' }, addressKey('countryId'), addressKey('stateId'), addressKey('cityId'), addressKey('postalCode'));
            }}
            placeholder={countries.length > 0 ? 'Choose the country' : 'No countries assigned to you'}
            searchable
            clearable={countries.length > 1}
            error={errors[addressKey('countryId')]}
            disabled={disabled || countries.length <= 1}
            aria-label="Customer country"
          />
          <Dropdown
            label="State"
            name="stateId"
            options={stateOptions}
            value={customer.stateId}
            onChange={(value) => {
              // A city belongs to one state: choosing another state clears it.
              if ((value || '') === customer.stateId) return;
              onChange({ stateId: value || '', cityId: '' }, addressKey('stateId'), addressKey('cityId'));
            }}
            placeholder={country ? 'Choose the state' : 'Choose the country first'}
            searchable
            clearable
            error={errors[addressKey('stateId')]}
            disabled={disabled || !country}
            aria-label="Customer state"
          />
          <Dropdown
            label="City"
            name="cityId"
            options={cityOptions}
            value={customer.cityId}
            onChange={(value) => onChange({ cityId: value || '' }, addressKey('cityId'))}
            placeholder={customer.stateId ? (cityOptions.length > 0 ? 'Choose the city' : 'No cities for this state yet') : 'Choose the state first'}
            searchable
            clearable
            error={errors[addressKey('cityId')]}
            disabled={disabled || !customer.stateId || cityOptions.length === 0}
            aria-label="Customer city"
          />
          <InputField
            label={country?.postalCode?.label || 'Postal code'}
            name="postalCode"
            value={customer.postalCode}
            onChange={(e) => onChange({ postalCode: e.target.value }, addressKey('postalCode'))}
            error={errors[addressKey('postalCode')]}
            maxLength={POSTAL_CODE_MAX_LENGTH}
            disabled={disabled}
          />
          <div className="sm:col-span-2">
            <TextArea
              label="Full address"
              name="address"
              placeholder="House / shop, street, area"
              value={customer.address}
              onChange={(e) => onChange({ address: e.target.value }, addressKey('address'))}
              maxLength={CUSTOMER_ADDRESS_MAX_LENGTH}
              rows={3}
              disabled={disabled}
            />
            {errors[addressKey('address')] && <p className="mt-1 text-sm text-red-600" role="alert">{errors[addressKey('address')]}</p>}
          </div>
        </>
      )}
    </div>
  );
};

export default CustomerFields;
