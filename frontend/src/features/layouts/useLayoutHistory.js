import { useCallback, useMemo, useReducer } from 'react';

// The design being edited ({ paper, elements }) with undo / redo. A drag or
// a run of typing into one box makes a single undo step.

const STEPS_MAX = 100;

const remember = (past, doc) => [...past.slice(-(STEPS_MAX - 1)), doc];

const reducer = (state, action) => {
  switch (action.type) {
    // mergeKey: changes with the same key in a row make one undo step.
    case 'change': {
      const doc = action.update(state.doc);
      if (doc === state.doc) return state;
      if (action.mergeKey && action.mergeKey === state.mergeKey) return { ...state, doc, future: [] };
      return { doc, past: remember(state.past, state.doc), future: [], mergeKey: action.mergeKey || null };
    }
    // Before a drag: one undo step, then 'drag' changes without adding more.
    case 'begin':
      return { ...state, past: remember(state.past, state.doc), future: [], mergeKey: null };
    case 'drag':
      return { ...state, doc: action.update(state.doc) };
    case 'undo':
      if (state.past.length === 0) return state;
      return { doc: state.past.at(-1), past: state.past.slice(0, -1), future: [state.doc, ...state.future], mergeKey: null };
    case 'redo':
      if (state.future.length === 0) return state;
      return { doc: state.future[0], past: remember(state.past, state.doc), future: state.future.slice(1), mergeKey: null };
    case 'reset':
      return { doc: action.doc, past: [], future: [], mergeKey: null };
    default:
      return state;
  }
};

/**
 * @param {{ paper, elements }} initialDoc
 * @returns {{ doc, change: (update, mergeKey?) => void, beginDrag, drag: (update) => void, undo, redo, reset: (doc) => void, canUndo, canRedo }}
 */
export const useLayoutHistory = (initialDoc) => {
  const [state, dispatch] = useReducer(reducer, { doc: initialDoc, past: [], future: [], mergeKey: null });

  const actions = useMemo(() => ({
    change: (update, mergeKey = null) => dispatch({ type: 'change', update, mergeKey }),
    beginDrag: () => dispatch({ type: 'begin' }),
    drag: (update) => dispatch({ type: 'drag', update }),
    undo: () => dispatch({ type: 'undo' }),
    redo: () => dispatch({ type: 'redo' }),
    reset: (doc) => dispatch({ type: 'reset', doc }),
  }), []);

  /** Changes one element: patch merges into it. */
  const changeElement = useCallback(
    (id, patch, mergeKey = null) => actions.change((doc) => ({ ...doc, elements: doc.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) }), mergeKey && `${id}:${mergeKey}`),
    [actions],
  );

  return { ...actions, changeElement, doc: state.doc, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
};

export default useLayoutHistory;
