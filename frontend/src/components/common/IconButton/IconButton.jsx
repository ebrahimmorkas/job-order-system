// A small square icon-only button for row actions. `label` is both the
// screen-reader name and the hover hint.
const VARIANTS = {
  default: 'text-gray-500 hover:text-gray-900 hover:bg-gray-100',
  danger: 'text-gray-500 hover:text-red-600 hover:bg-red-50',
};

const SIZES = {
  md: 'w-8 h-8',
  sm: 'w-4 h-7',
};

const IconButton = ({ label, icon: Icon, onClick, disabled = false, variant = 'default', size = 'md' }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className={`inline-flex items-center justify-center ${SIZES[size]} rounded-md transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent ${VARIANTS[variant]}`}
  >
    <Icon className="w-4 h-4" />
  </button>
);

export default IconButton;
