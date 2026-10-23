import { useId, useState } from 'react';

// A small number box with a label and an optional unit ("mm"). While typing,
// only a valid number within min..max is passed on; leaving the box shows
// the value in use again.
const NumberField = ({ label, value, onChange, min = null, max = null, step = 1, unit = '', disabled = false, className = '' }) => {
  const id = useId();
  // What is typed, while the box is being edited.
  const [draft, setDraft] = useState(null);

  const handleChange = (e) => {
    setDraft(e.target.value);
    const number = Number(e.target.value);
    if (e.target.value.trim() === '' || !Number.isFinite(number)) return;
    if ((min !== null && number < min) || (max !== null && number > max)) return;
    onChange(number);
  };

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <div className="flex items-center rounded-md border border-gray-300 bg-white focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={draft ?? value ?? ''}
          min={min ?? undefined}
          max={max ?? undefined}
          step={step}
          disabled={disabled}
          onChange={handleChange}
          onBlur={() => setDraft(null)}
          className="w-full min-w-0 rounded-md bg-transparent px-2 py-1.5 text-sm text-gray-900 focus:outline-none disabled:text-gray-400"
        />
        {unit && <span className="pr-2 text-xs text-gray-400" aria-hidden="true">{unit}</span>}
      </div>
    </div>
  );
};

export default NumberField;
