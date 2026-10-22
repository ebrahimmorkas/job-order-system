const isSameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Why `name` can't be added to `items` (exceptKey: the item being renamed),
 * or null when it can. Also used by a page that saves a typed but not yet
 * added item.
 *
 * @param {Array<{ key: string, name: string }>} items
 * @param {string} name
 * @param {Object} rules
 * @param {number|null} rules.itemsAllowed - null = no limit
 * @param {number|null} [rules.maxLength] - null = no limit
 * @param {{ singular: string, plural: string, owner: string }} rules.noun - e.g. value / values / master
 * @param {string|null} [exceptKey]
 */
export const checkItemName = (items, name, { itemsAllowed, maxLength = null, noun }, exceptKey = null) => {
  const trimmed = name.trim();
  if (!trimmed) return `Enter a ${noun.singular}`;
  if (maxLength !== null && trimmed.length > maxLength) return `A ${noun.singular} can be at most ${maxLength} characters`;
  if (items.some((item) => item.key !== exceptKey && isSameName(item.name, trimmed))) return `"${trimmed}" is already in the list`;
  if (exceptKey === null && itemsAllowed !== null && items.length >= itemsAllowed) return `A ${noun.owner} can have at most ${itemsAllowed} ${noun.plural}`;
  return null;
};

export default checkItemName;
