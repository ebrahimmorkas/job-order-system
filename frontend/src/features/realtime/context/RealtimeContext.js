import { createContext } from 'react';

// Outside a RealtimeProvider nothing is ever heard.
export const RealtimeContext = createContext({ subscribe: () => () => {} });
