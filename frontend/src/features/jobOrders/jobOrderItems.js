// The items of a job order (each with its job name, masters, controls,
// images and work). Same as the backend (utils/jobOrderItems.js).

// Same as the backend (constants/jobOrderConstants.js).
export const JOB_NAME_MAX_LENGTH = 100;

/**
 * What an item is called: "Item 2 · Square glass" (or "Item 2") when the job
 * order has several items, else its job name ('' without one).
 */
export const itemLabelOf = (item, index, count) => {
  if (count > 1) return `Item ${index + 1}${item.name ? ` · ${item.name}` : ''}`;
  return item.name || '';
};
