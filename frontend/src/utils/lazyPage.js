import { lazy } from 'react';

const RELOADED_KEY = 'pageCodeReloaded';

const readFlag = () => {
  try {
    return sessionStorage.getItem(RELOADED_KEY) === '1';
  } catch {
    return true; // No storage: never reload, so it can't loop.
  }
};

const writeFlag = (isOn) => {
  try {
    if (isOn) sessionStorage.setItem(RELOADED_KEY, '1');
    else sessionStorage.removeItem(RELOADED_KEY);
  } catch {
    // No storage - nothing to remember.
  }
};

/**
 * React.lazy for a page: its code is downloaded the first time it is opened.
 * If that fails right after a new version went online (the old files are
 * gone), the page is reloaded once to get the new version; a second failure
 * is left to PageLoadBoundary.
 *
 * @param {() => Promise<{ default: React.ComponentType }>} load - e.g. () => import('./UsersPage')
 */
export const lazyPage = (load) => lazy(() => load()
  .then((module) => {
    writeFlag(false);
    return module;
  })
  .catch((err) => {
    if (readFlag()) throw err;
    writeFlag(true);
    window.location.reload();
    // Never settles - the page is reloading.
    return new Promise(() => {});
  }));

export default lazyPage;
