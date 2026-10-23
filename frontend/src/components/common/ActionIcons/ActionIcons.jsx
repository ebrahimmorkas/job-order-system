// Small line icons for row actions. All decorative: every button using one
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

export const ViewIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M2.25 12s3.5-6.75 9.75-6.75S21.75 12 21.75 12s-3.5 6.75-9.75 6.75S2.25 12 2.25 12z" />
    <circle cx="12" cy="12" r="2.75" />
  </svg>
);

export const BackIcon = (props) => (
  <svg {...base} {...props}><path d="M19 12H5M11.5 5.5L5 12l6.5 6.5" /></svg>
);

export const StarIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M12 3.75l2.55 5.17 5.7.83-4.13 4.02.98 5.68L12 16.77l-5.1 2.68.98-5.68-4.13-4.02 5.7-.83L12 3.75z" />
  </svg>
);

export const PrintIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M6.75 8.25V3.75h10.5v4.5M6.75 17.25h-1.5a1.5 1.5 0 01-1.5-1.5v-6a1.5 1.5 0 011.5-1.5h13.5a1.5 1.5 0 011.5 1.5v6a1.5 1.5 0 01-1.5 1.5h-1.5" />
    <rect x="6.75" y="13.5" width="10.5" height="6.75" rx="1" />
  </svg>
);
