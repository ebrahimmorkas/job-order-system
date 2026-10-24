import { useEffect, useState } from 'react';
import theme from './theme/theme';
import { lockBodyScroll, unlockBodyScroll } from '../../../utils/scrollLock';
import { DEFAULT_NAV_ITEMS } from './navItems';
import { MenuIcon, CloseIcon, LogoutIcon, CollapseIcon, ExpandIcon } from './icons';

const getInitials = (label) => {
  if (!label) return 'U';
  const parts = label.trim().split(/\s+/);
  const initials = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0].slice(0, 2);
  return initials.toUpperCase();
};

const capitalize = (value) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : '');

// The company logo when there is one, otherwise the first letter of the name.
// The image is decorative - the name is always shown next to it.
const BrandLogo = ({ brand, logoUrl, className }) =>
  logoUrl ? (
    <img src={logoUrl} alt="" className={`object-contain shrink-0 ${className}`} />
  ) : (
    <div className={`flex items-center justify-center font-bold shrink-0 ${theme.brand.mark} ${className}`}>
      {brand?.[0]?.toUpperCase()}
    </div>
  );

// Folds the desktop menu down to its icons, or opens it again.
const CollapseButton = ({ isCollapsed, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center justify-center p-1.5 rounded-md cursor-pointer shrink-0 ${theme.toggle.base}`}
    aria-label={isCollapsed ? 'Open the menu' : 'Close the menu'}
    title={isCollapsed ? 'Open the menu' : 'Close the menu'}
    aria-expanded={!isCollapsed}
  >
    {isCollapsed ? <ExpandIcon className="w-5 h-5" /> : <CollapseIcon className="w-5 h-5" />}
  </button>
);

const BrandMark = ({ brand, logoUrl, subtitle, isCollapsed = false, toggle = null }) => (isCollapsed ? (
  <div className="py-3 flex flex-col items-center gap-2 shrink-0">
    <BrandLogo brand={brand} logoUrl={logoUrl} className="w-9 h-9 rounded-xl text-base" />
    {toggle}
  </div>
) : (
  <div className="min-h-16 py-2 flex items-center gap-2.5 px-4 shrink-0">
    <BrandLogo brand={brand} logoUrl={logoUrl} className="w-9 h-9 rounded-xl text-base" />
    <div className="min-w-0 flex-1">
      {/* A long company name wraps to two lines before it is cut off; the full name is in the tooltip. */}
      <p title={brand} className={`text-base font-bold leading-tight line-clamp-2 break-words ${theme.brand.text}`}>{brand}</p>
      {subtitle && <p className={`text-xs leading-tight truncate ${theme.brand.subtitle}`}>{subtitle}</p>}
    </div>
    {toggle}
  </div>
));

// Folded: only the icons, each with its name as a tooltip.
const NavLinks = ({ items, activeKey, onSelect, isCollapsed = false }) => (
  <nav className={`flex-1 overflow-y-auto py-2 space-y-0.5 ${isCollapsed ? 'px-2' : 'px-3'}`}>
    {items.map((item) => {
      const isActive = item.key === activeKey;
      const Icon = item.icon;
      return (
        <a
          key={item.key}
          href={item.path}
          // A plain click stays in the app; Ctrl / middle click opens a new tab.
          onClick={(e) => {
            if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            onSelect(item.key);
          }}
          className={`group relative w-full flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 cursor-pointer ${
            isCollapsed ? 'justify-center px-0' : 'pl-3.5 pr-3'
          } ${isActive ? theme.link.active : theme.link.base}`}
          aria-current={isActive ? 'page' : undefined}
          title={isCollapsed ? item.label : undefined}
        >
          {isActive && <span className={`absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full ${theme.link.activeBar}`} />}
          {Icon && <Icon className={`w-5 h-5 shrink-0 ${isActive ? theme.link.iconActive : theme.link.iconBase}`} />}
          <span className={isCollapsed ? 'sr-only' : 'truncate'}>{item.label}</span>
        </a>
      );
    })}
  </nav>
);

const UserFooter = ({ user, onLogout, isCollapsed = false }) => {
  if (!user) return null;
  const displayName = user.name || user.username || user.email || 'Account';
  const role = capitalize(user.role);

  if (isCollapsed) {
    return (
      <div className={`shrink-0 border-t py-3 flex flex-col items-center gap-2 ${theme.footer.border}`}>
        <div title={role ? `${displayName} (${role})` : displayName} className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${theme.footer.avatar}`}>
          {getInitials(displayName)}
        </div>
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className={`p-1.5 rounded-md transition-colors duration-150 cursor-pointer ${theme.footer.logout}`}
            aria-label="Logout"
            title="Logout"
          >
            <LogoutIcon className="w-5 h-5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`shrink-0 border-t p-3 ${theme.footer.border}`}>
      <div className={`flex items-center gap-3 px-2 py-2 rounded-lg transition-colors duration-150 ${theme.footer.hover}`}>
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${theme.footer.avatar}`}>
          {getInitials(displayName)}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${theme.footer.name}`}>{displayName}</p>
          {role && <p className={`text-xs truncate ${theme.footer.role}`}>{role}</p>}
        </div>
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className={`p-1.5 rounded-md transition-colors duration-150 cursor-pointer ${theme.footer.logout}`}
            aria-label="Logout"
          >
            <LogoutIcon className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Left-hand navigation for the logged-in app.
 *
 * Renders as a column on desktop (md+) - full, or folded to its icons - and collapses
 * into a hamburger-triggered off-canvas drawer with a backdrop on mobile
 * (the hamburger trigger itself only exists below the md breakpoint).
 *
 * @param {Object} props
 * @param {string} [props.brand] - Company name shown at the top.
 * @param {string|null} [props.logoUrl] - Company logo; the name's first letter is shown when absent.
 * @param {string} [props.subtitle] - Small text shown under the brand name.
 * @param {Array<{key: string, path: string, label: string, icon?: Function}>} [props.items] - Nav links, defaults to DEFAULT_NAV_ITEMS.
 * @param {string} props.activeKey - Key of the currently active item.
 * @param {Function} props.onNavigate - Called with an item's key when it is selected.
 * @param {Object} [props.user] - Current user ({ name, username, email, role }); footer is omitted if absent.
 * @param {Function} [props.onLogout] - Called when the footer's logout button is clicked.
 * @param {boolean} [props.isCollapsed] - Desktop: only the icons are shown.
 * @param {Function} [props.onToggleCollapse] - Desktop: folds / opens the menu (no button without it).
 */
const Sidebar = ({
  brand = '',
  logoUrl = null,
  subtitle,
  items = DEFAULT_NAV_ITEMS,
  activeKey,
  onNavigate,
  user,
  onLogout,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Close the mobile drawer on Escape and lock page scroll while it's open.
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);

    lockBodyScroll();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      unlockBodyScroll();
    };
  }, [isOpen]);

  // Collapsing back to desktop width while the drawer is open would otherwise
  // leave the scroll lock stuck on and the drawer mounted-but-hidden.
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    const handleChange = (e) => {
      if (e.matches) setIsOpen(false);
    };
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  const handleSelect = (key) => {
    setIsOpen(false);
    onNavigate?.(key);
  };

  return (
    <>
      {/* Mobile top bar - the hamburger trigger only ever renders here, never on desktop */}
      <div
        className={`md:hidden flex items-center justify-between px-4 h-14 ${theme.sidebar.background} border-b ${theme.sidebar.border}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <BrandLogo brand={brand} logoUrl={logoUrl} className="w-8 h-8 rounded-lg text-sm" />
          <span title={brand} className={`text-base font-bold leading-tight line-clamp-2 break-words ${theme.brand.text}`}>{brand}</span>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`inline-flex items-center justify-center p-2 rounded-md cursor-pointer ${theme.toggle.base}`}
          aria-label="Open navigation menu"
          aria-haspopup="true"
          aria-expanded={isOpen}
        >
          <MenuIcon className="w-6 h-6" />
        </button>
      </div>

      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex md:flex-col md:shrink-0 md:h-screen md:sticky md:top-0 transition-[width] duration-200 ${
          isCollapsed ? 'md:w-[4.5rem]' : 'md:w-64'
        } ${theme.sidebar.background} border-r ${theme.sidebar.border}`}
      >
        <BrandMark
          brand={brand}
          logoUrl={logoUrl}
          subtitle={subtitle}
          isCollapsed={isCollapsed}
          toggle={onToggleCollapse && <CollapseButton isCollapsed={isCollapsed} onClick={onToggleCollapse} />}
        />
        <NavLinks items={items} activeKey={activeKey} onSelect={handleSelect} isCollapsed={isCollapsed} />
        <UserFooter user={user} onLogout={onLogout} isCollapsed={isCollapsed} />
      </aside>

      {/* Mobile drawer */}
      <div
        className={`md:hidden fixed inset-0 z-50 transition-opacity duration-200 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div
          className={`absolute inset-0 ${theme.drawer.overlay}`}
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
        <aside
          className={`absolute inset-y-0 left-0 flex flex-col w-72 max-w-[80%] h-full ${theme.drawer.background} ${theme.drawer.shadow} transform transition-transform duration-200 ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className={`h-14 flex items-center justify-between px-4 border-b ${theme.drawer.border} shrink-0`}>
            <div className="flex items-center gap-2.5">
              <BrandLogo brand={brand} logoUrl={logoUrl} className="w-8 h-8 rounded-lg text-sm" />
              <span className={`text-base font-bold ${theme.brand.text}`}>{brand}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className={`inline-flex items-center justify-center p-2 rounded-md cursor-pointer ${theme.toggle.base}`}
              aria-label="Close navigation menu"
            >
              <CloseIcon className="w-6 h-6" />
            </button>
          </div>
          <NavLinks items={items} activeKey={activeKey} onSelect={handleSelect} />
          <UserFooter user={user} onLogout={onLogout} />
        </aside>
      </div>
    </>
  );
};

export default Sidebar;
