import { useContext, useEffect, useRef } from 'react';
import { RealtimeContext } from '../context/RealtimeContext';

/**
 * Calls handler(data) each time the server sends the event (or one of the
 * events) while the component is on screen.
 *
 *   useRealtimeEvent([REALTIME_EVENTS.JOB_ORDERS_CHANGED, REALTIME_EVENTS.RECONNECTED], reload);
 *
 * @param {string|string[]} events
 * @param {(data: Object) => void} handler - the latest one is always used
 */
export const useRealtimeEvent = (events, handler) => {
  const { subscribe } = useContext(RealtimeContext);
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  const key = [].concat(events).join(' ');
  useEffect(() => {
    const unsubscribers = key.split(' ').map((event) => subscribe(event, (data) => handlerRef.current(data)));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [key, subscribe]);
};

export default useRealtimeEvent;
