import { useEffect, useState } from 'react';

/**
 * `value`, but only after it has stopped changing for `delay` ms - e.g. a
 * search box that should send one request when typing pauses, not one per key.
 */
export const useDebouncedValue = (value, delay = 300) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
};

export default useDebouncedValue;
