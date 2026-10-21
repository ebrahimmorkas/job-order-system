// Outline icons for the error screens. They take the size and colour of
// their container (currentColor).
const Icon = ({ d }) => (
  <svg className="h-full w-full" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

// Magnifying glass
export const NotFoundIcon = () => <Icon d="M21 21l-5.2-5.2M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" />;

// Padlock
export const ForbiddenIcon = () => <Icon d="M16.5 10.5V7a4.5 4.5 0 10-9 0v3.5M6.75 21h10.5a2.25 2.25 0 002.25-2.25v-6a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6A2.25 2.25 0 006.75 21z" />;

// Person
export const UnauthorizedIcon = () => <Icon d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.1a7.5 7.5 0 0115 0A17.9 17.9 0 0112 21.75c-2.68 0-5.22-.58-7.5-1.65z" />;

// Warning triangle
export const ServerErrorIcon = () => <Icon d="M12 9v3.75m0 3.75h.008M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />;

// Crossed-out signal
export const OfflineIcon = () => <Icon d="M3 3l18 18M8.5 16.4a5 5 0 017 0M5.3 13.2a9.5 9.5 0 014.2-2.3M12 20h.01M2 9.9a14.5 14.5 0 014.2-2.6M14.6 6.4A14.5 14.5 0 0122 9.9M18.7 13.2c-.6-.6-1.3-1.1-2-1.5" />;
