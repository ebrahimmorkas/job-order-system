import { CollapseIcon, ExpandIcon } from '../../../components/ui/Sidebar/icons';

// The left panel folds to the left, the right one to the right.
const arrowsOf = (side) => (side === 'left'
  ? { close: CollapseIcon, open: ExpandIcon }
  : { close: (props) => <CollapseIcon {...props} className={`${props.className} -scale-x-100`} />, open: (props) => <ExpandIcon {...props} className={`${props.className} -scale-x-100`} /> });

const ToggleButton = ({ label, icon: Icon, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center justify-center p-1.5 rounded-md cursor-pointer shrink-0 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
    aria-label={label}
    title={label}
  >
    <Icon className="w-5 h-5" />
  </button>
);

/**
 * A side panel of the layout designer that can be folded away: open, it shows
 * its title and a fold button on the canvas side; folded, a slim strip with
 * the button to open it again, and the page gets the room.
 *
 * @param {Object} props
 * @param {'left'|'right'} props.side
 * @param {string} props.title - e.g. "Items"
 * @param {string} props.ariaLabel - The panel's name for screen readers
 * @param {boolean} props.isOpen
 * @param {() => void} props.onToggle
 * @param {string} props.className - The open panel's classes
 * @param {React.ReactNode} props.children
 */
const SidePanel = ({ side, title, ariaLabel, isOpen, onToggle, className, children }) => {
  const arrows = arrowsOf(side);
  if (!isOpen) {
    return (
      <aside className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-1 lg:flex-col" aria-label={`${title} (folded)`}>
        <ToggleButton label={`Open the ${title.toLowerCase()} panel`} icon={arrows.open} onClick={onToggle} />
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 lg:[writing-mode:vertical-rl] lg:rotate-180 lg:mt-1">{title}</span>
      </aside>
    );
  }
  return (
    <aside className={`flex flex-col ${className}`} aria-label={ariaLabel}>
      <div className={`mb-2 flex items-center justify-between gap-2 ${side === 'right' ? 'flex-row-reverse' : ''}`}>
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</span>
        <ToggleButton label={`Close the ${title.toLowerCase()} panel`} icon={arrows.close} onClick={onToggle} />
      </div>
      <div className="min-h-0 flex-1 lg:overflow-y-auto">{children}</div>
    </aside>
  );
};

export default SidePanel;
