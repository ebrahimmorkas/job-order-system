/**
 * The parts of an address after the leading '/', decoded. A part that can't
 * be decoded is kept as typed (the page then shows "not found").
 *
 * @param {string} pathname - e.g. '/users/123/edit'
 * @returns {string[]} e.g. ['users', '123', 'edit']
 */
export const segmentsOf = (pathname) =>
  pathname.split('/').filter(Boolean).map((segment) => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  });

/**
 * Which screen of a section an address is (the parts after the section's
 * own, e.g. '/masters/123/copy' -> ['123', 'copy']):
 *   (none)        -> { mode: 'list' }
 *   new           -> { mode: 'create' }
 *   :id           -> { mode: 'view', id }        (only with `view`)
 *   :id/<action>  -> { mode: actions[action], id }
 *
 * @param {string[]} segments
 * @param {{ view?: boolean, actions?: Object<string, string> }} [options]
 *   actions: address word -> mode, e.g. { edit: 'edit', copy: 'clone' }
 * @returns {{ mode: string, id?: string }|null} null = no such screen
 */
export const screenOf = (segments, { view = false, actions = {} } = {}) => {
  const [first, second, ...rest] = segments;
  if (rest.length > 0) return null;
  if (!first) return { mode: 'list' };
  if (first === 'new') return second ? null : { mode: 'create' };
  if (!second) return view ? { mode: 'view', id: first } : null;
  return Object.hasOwn(actions, second) ? { mode: actions[second], id: first } : null;
};
