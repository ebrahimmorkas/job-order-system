// Icons used by the masters screens. All decorative: every button using one
// has its own aria-label.
const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
  'aria-hidden': true,
};

export const MoveUpIcon = (props) => (
  <svg {...base} {...props}><path d="M17 20V4l-5 5" /></svg>
);

export const MoveDownIcon = (props) => (
  <svg {...base} {...props}><path d="M7 4v16l5-5" /></svg>
);

export const EditIcon = (props) => (
  <svg {...base} {...props}><path d="M16.86 4.49a2.1 2.1 0 113 2.97L8.25 19.08 4 20l.92-4.25L16.86 4.49z" /></svg>
);

export const CopyIcon = (props) => (
  <svg {...base} {...props}>
    <rect x="8.25" y="8.25" width="12" height="12" rx="2" />
    <path d="M15.75 8.25V5.75a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2h2.5" />
  </svg>
);

export const TrashIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M4.5 6.75h15M9.75 6.75V4.5h4.5v2.25M6.75 6.75l.75 12.75h9l.75-12.75M10.25 10.5v6M13.75 10.5v6" />
  </svg>
);

export const PlusIcon = (props) => (
  <svg {...base} {...props}><path d="M12 5v14M5 12h14" /></svg>
);

export const BackIcon = (props) => (
  <svg {...base} {...props}><path d="M19 12H5M11.5 5.5L5 12l6.5 6.5" /></svg>
);
