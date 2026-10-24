const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
};

export const DashboardIcon = (props) => (
  <svg {...base} {...props}>
    <rect x="3.75" y="3.75" width="7.5" height="7.5" rx="1.5" />
    <rect x="12.75" y="3.75" width="7.5" height="4.5" rx="1.5" />
    <rect x="12.75" y="10.5" width="7.5" height="9.75" rx="1.5" />
    <rect x="3.75" y="13.5" width="7.5" height="6.75" rx="1.5" />
  </svg>
);

export const UsersIcon = (props) => (
  <svg {...base} {...props}>
    <circle cx="9" cy="7.5" r="3.25" />
    <path d="M2.75 19.5a6.25 6.25 0 0112.5 0" />
    <path d="M18.75 8.25v6m3-3h-6" />
  </svg>
);

export const RolesIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M12 3l7.5 3v5.25c0 4.5-3.15 8.4-7.5 9.75-4.35-1.35-7.5-5.25-7.5-9.75V6L12 3z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

export const CompanySettingsIcon = (props) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H4a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H10a1.65 1.65 0 001-1.51V4a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V10c.36.24.8.38 1.28.38H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);

export const MastersIcon = (props) => (
  <svg {...base} {...props}>
    <rect x="3.75" y="4.5" width="16.5" height="15" rx="2" />
    <path d="M7.5 9h9M7.5 12.75h9M7.5 16.5h5.25" />
  </svg>
);

export const JobOrdersIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M8.25 4.5h-1.5a2.25 2.25 0 00-2.25 2.25v12A2.25 2.25 0 006.75 21h10.5a2.25 2.25 0 002.25-2.25v-12A2.25 2.25 0 0017.25 4.5h-1.5" />
    <rect x="8.25" y="3" width="7.5" height="3" rx="1" />
    <path d="M8.25 11.25h7.5M8.25 15h4.5" />
  </svg>
);

export const MyWorkIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M8.25 4.5h-1.5a2.25 2.25 0 00-2.25 2.25v12A2.25 2.25 0 006.75 21h10.5a2.25 2.25 0 002.25-2.25v-12A2.25 2.25 0 0017.25 4.5h-1.5" />
    <rect x="8.25" y="3" width="7.5" height="3" rx="1" />
    <path d="M9 13.5l2 2 4-4" />
  </svg>
);

export const ControlsIcon = (props) => (
  <svg {...base} {...props}>
    <rect x="3.75" y="4.5" width="16.5" height="5.25" rx="1.5" />
    <rect x="3.75" y="14.25" width="4.5" height="4.5" rx="1" />
    <path d="M11.25 16.5h9" />
  </svg>
);

export const MenuIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

export const CloseIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export const LogoutIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M8.25 9V5.25A2.25 2.25 0 0110.5 3h6a2.25 2.25 0 012.25 2.25v13.5A2.25 2.25 0 0116.5 21h-6a2.25 2.25 0 01-2.25-2.25V15" />
    <path d="M12 12h9m0 0l-3-3m3 3l-3 3" />
  </svg>
);

export const LayoutsIcon = (props) => (
  <svg {...base} {...props}>
    <rect x="4.5" y="3" width="15" height="18" rx="1.5" />
    <path d="M7.5 6.75h9M7.5 10.5h4.5M7.5 14.25h4.5" />
    <rect x="14.25" y="10.5" width="2.25" height="6.75" rx="0.5" />
  </svg>
);
