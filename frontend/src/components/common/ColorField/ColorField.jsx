import { useId } from 'react';

// A colour picker with its #rrggbb code beside it.
const ColorField = ({ label, value, onChange, disabled = false, className = '' }) => {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <div className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-1.5 py-1 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
        <input
          id={id}
          type="color"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0 disabled:cursor-not-allowed"
        />
        <span className="font-mono text-xs text-gray-600">{value}</span>
      </div>
    </div>
  );
};

export default ColorField;
