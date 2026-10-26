// How the control will look on the job order form (not interactive).
const ControlPreview = ({ type, label, isRequired, placeholder, defaultText, isPrice, isPriceIncludedInTax, isQuantity, isUnit, defaultChecked, options }) => {
  const title = label.trim() || (type === 'checkbox' ? 'Checkbox text' : 'Label');
  const required = isRequired && <span className="text-red-500"> *</span>;
  const box = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400';

  if (type === 'checkbox') {
    return (
      <label className="inline-flex items-start gap-2 text-sm text-gray-800">
        <input type="checkbox" checked={defaultChecked} readOnly tabIndex={-1} className="mt-0.5 w-4 h-4 accent-indigo-600" />
        <span className="break-words">{title}{required}</span>
      </label>
    );
  }

  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-sm font-medium text-gray-700 break-words">{title}{required}</legend>
      {type === 'textfield' && <input className={box} value={defaultText} placeholder={placeholder} inputMode={isPrice ? 'decimal' : undefined} readOnly tabIndex={-1} />}
      {type === 'textfield' && !isPrice && isQuantity && <p className="mt-1 text-xs text-gray-500">Quantity - a whole number</p>}
      {type === 'textfield' && isPrice && (
        <p className="mt-1 text-xs text-gray-500">{isPriceIncludedInTax ? 'Price - tax is charged on it' : 'Price - no tax on it'}</p>
      )}
      {type === 'textarea' && <textarea className={box} rows={3} value={defaultText} placeholder={placeholder} readOnly tabIndex={-1} />}
      {type === 'dropdown' && (
        <select className={box} value={options.find((option) => option.isDefault)?.key || ''} disabled tabIndex={-1} aria-label={title}>
          <option value="">{options.length === 0 ? 'Add choices below' : 'Choose one'}</option>
          {options.map((option) => <option key={option.key} value={option.key}>{option.name}</option>)}
        </select>
      )}
      {type === 'dropdown' && isUnit && <p className="mt-1 text-xs text-gray-500">Pricing unit - on a per unit item it asks the size and fills in the rate</p>}
      {type === 'radio' && (
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {options.length === 0 && <span className="text-sm text-gray-400">Add choices below</span>}
          {options.map((option) => (
            <label key={option.key} className="inline-flex items-center gap-2 text-sm text-gray-800">
              <input type="radio" checked={option.isDefault} readOnly tabIndex={-1} className="w-4 h-4 accent-indigo-600" />
              <span className="break-words">{option.name}</span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
};

export default ControlPreview;
