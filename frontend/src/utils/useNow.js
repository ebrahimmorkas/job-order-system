import { useEffect, useState } from 'react';

/**
 * The current time (ms), updated every intervalMs - for "time left" text
 * that stays right while the page is open.
 *
 * @param {number} [intervalMs]
 * @returns {number}
 */
export const useNow = (intervalMs = 30000) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
};

export default useNow;
