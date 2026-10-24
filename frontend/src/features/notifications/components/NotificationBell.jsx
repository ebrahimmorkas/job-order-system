import { useCallback, useEffect, useRef, useState } from 'react';
import Spinner from '../../../components/common/Spinner';
import { useToast } from '../../../components/common/Toast';
import { useRouter } from '../../../router';
import { useConfirmLeave } from '../../../components/common/UnsavedChanges';
import { useRealtimeEvent } from '../../realtime/hooks/useRealtimeEvent';
import { REALTIME_EVENTS } from '../../realtime/events';
import { formatDueAt } from '../../jobOrders/workTime';
import * as notificationsApi from '../api/notificationsApi';

const PAGE_SIZE = 20;

const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24' };
const BellIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M6 9.75a6 6 0 1112 0v3.5l1.5 3H4.5l1.5-3v-3.5z" />
    <path d="M10 19.25a2 2 0 004 0" />
  </svg>
);

// Each kind with its colour; "page" says which page opens it (none: the work
// is no longer theirs).
const KINDS = {
  workGiven: { dot: 'bg-indigo-500', page: '/my-work' },
  timeChanged: { dot: 'bg-sky-500', page: '/my-work' },
  workTaken: { dot: 'bg-gray-400', page: null },
  stepChanged: { dot: 'bg-indigo-500', page: '/job-orders' },
  onHold: { dot: 'bg-amber-500', page: '/job-orders' },
  completed: { dot: 'bg-emerald-500', page: '/job-orders' },
  overdue: { dot: 'bg-red-500', page: '/job-orders' },
};

const timeAgoOf = (value) => {
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h ago`;
  return formatDueAt(value);
};

/**
 * The bell at the top of every page: how many unread, and the list - new
 * ones arrive live (with a toast). A notification opens its job order.
 */
const NotificationBell = () => {
  const toast = useToast();
  const { navigate } = useRouter();
  const confirmLeave = useConfirmLeave();
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Bumped to load the first page again (after reconnecting).
  const [reloadKey, setReloadKey] = useState(0);
  const panelRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    notificationsApi.listNotifications({ limit: PAGE_SIZE }, { signal: controller.signal })
      .then((result) => {
        setItems(result.notifications);
        setUnreadCount(result.unreadCount);
        setHasMore(result.hasMore);
      })
      // The bell stays empty; the page's own requests show what is wrong.
      .catch(() => {})
      .finally(() => !controller.signal.aborted && setIsLoading(false));
    return () => controller.abort();
  }, [reloadKey]);

  useRealtimeEvent(REALTIME_EVENTS.NOTIFICATION, ({ notification }) => {
    setItems((prev) => [notification, ...prev.filter((item) => item._id !== notification._id)]);
    setUnreadCount((n) => n + 1);
    toast(notification.message || notification.title, { title: notification.message ? notification.title : undefined });
  });
  useRealtimeEvent(REALTIME_EVENTS.NOTIFICATIONS_READ, ({ unreadCount: count }) => {
    setUnreadCount(count);
    if (count === 0) setItems((prev) => prev.map((item) => item.readAt ? item : { ...item, readAt: new Date().toISOString() }));
  });
  useRealtimeEvent(REALTIME_EVENTS.RECONNECTED, () => setReloadKey((n) => n + 1));

  // Closes on a click outside or Escape.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onMouseDown = (e) => panelRef.current && !panelRef.current.contains(e.target) && setIsOpen(false);
    const onKeyDown = (e) => e.key === 'Escape' && setIsOpen(false);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  const markRead = useCallback(async (ids) => {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((item) => (!item.readAt && (!ids || ids.includes(item._id)) ? { ...item, readAt: now } : item)));
    try {
      const result = await notificationsApi.markRead(ids);
      setUnreadCount(result.unreadCount);
    } catch (err) {
      toast.error(err.message);
    }
  }, [toast]);

  const loadMore = async () => {
    setIsLoadingMore(true);
    try {
      const result = await notificationsApi.listNotifications({ before: items[items.length - 1].createdAt, limit: PAGE_SIZE });
      setItems((prev) => [...prev, ...result.notifications]);
      setHasMore(result.hasMore);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const openItem = (item) => {
    if (!item.readAt) markRead([item._id]);
    const page = KINDS[item.type]?.page;
    if (!page || !item.jobOrderId) return;
    setIsOpen(false);
    confirmLeave(() => navigate(`${page}/${item.jobOrderId}`));
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={isOpen}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-white hover:text-gray-900 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer"
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 inline-flex min-w-[1.125rem] h-[1.125rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-gray-50">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div role="dialog" aria-label="Notifications" className="absolute right-0 z-40 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-semibold text-gray-900">Notifications</p>
            {unreadCount > 0 && (
              <button type="button" onClick={() => markRead()} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 cursor-pointer">
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-[26rem] overflow-y-auto">
            {isLoading && <div className="flex justify-center py-10"><Spinner /></div>}
            {!isLoading && items.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-gray-500">No notifications yet.</p>
            )}
            <ul className="divide-y divide-gray-100">
              {items.map((item) => {
                const kind = KINDS[item.type] || KINDS.workTaken;
                return (
                  <li key={item._id}>
                    <button
                      type="button"
                      onClick={() => openItem(item)}
                      className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 cursor-pointer ${item.readAt ? '' : 'bg-indigo-50/60'}`}
                    >
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${kind.dot}`} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm ${item.readAt ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>{item.title}</span>
                        {item.message && <span className="mt-0.5 block text-sm text-gray-600 break-words">{item.message}</span>}
                        <span className="mt-1 block text-xs text-gray-400">{timeAgoOf(item.createdAt)}</span>
                      </span>
                      {!item.readAt && <span className="sr-only">Unread</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
            {hasMore && (
              <div className="border-t border-gray-100 p-2">
                <button type="button" onClick={loadMore} disabled={isLoadingMore} className="w-full rounded-lg py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 cursor-pointer">
                  {isLoadingMore ? 'Loading...' : 'Show older'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
