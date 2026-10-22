// "Default" on a value row: a radio, so only one value of a master is the
// default. Clicking the chosen one again removes the default. Only an active
// value can be the default.
const DefaultChoice = ({ name, valueName, checked, isActive, onToggle, disabled = false }) => (
  <label
    className={`inline-flex items-center gap-1.5 text-xs ${isActive ? 'text-gray-600 cursor-pointer' : 'text-gray-300 cursor-not-allowed'}`}
    title={isActive ? (checked ? 'Default - click to remove' : 'Make default') : 'An inactive value cannot be the default'}
  >
    <input
      type="radio"
      name={name}
      checked={checked}
      readOnly
      onClick={onToggle}
      disabled={disabled || !isActive}
      aria-label={checked ? `"${valueName}" is the default` : `Make "${valueName}" the default`}
      className="w-4 h-4 accent-indigo-600 cursor-pointer disabled:cursor-not-allowed"
    />
    <span className="hidden sm:inline">Default</span>
  </label>
);

export default DefaultChoice;
