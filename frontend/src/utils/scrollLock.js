// Page scroll lock shared by everything that covers the page (Modal, the
// mobile Sidebar drawer...). Counted, so when two are open and the first one
// closes, the page stays locked until the last one closes - each saving and
// restoring body.overflow on its own would leave it stuck locked or unlocked.
const scrollLock = { count: 0, originalOverflow: '' };

export const lockBodyScroll = () => {
  if (scrollLock.count === 0) {
    scrollLock.originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  scrollLock.count += 1;
};

export const unlockBodyScroll = () => {
  scrollLock.count = Math.max(0, scrollLock.count - 1);
  if (scrollLock.count === 0) {
    document.body.style.overflow = scrollLock.originalOverflow;
  }
};
