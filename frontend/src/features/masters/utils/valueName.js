// Same limit as the backend (constants/masterConstants.js).
export const VALUE_NAME_MAX_LENGTH = 100;

const isSameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Why `name` can't be added to `values` (exceptKey: the value being renamed),
 * or null when it can. Also used when saving with a typed but not yet added value.
 */
export const checkValueName = (values, name, valuesAllowed, exceptKey = null) => {
  const trimmed = name.trim();
  if (!trimmed) return 'Enter a value';
  if (values.some((value) => value.key !== exceptKey && isSameName(value.name, trimmed))) return `"${trimmed}" is already in the list`;
  if (exceptKey === null && valuesAllowed !== null && values.length >= valuesAllowed) return `A master can have at most ${valuesAllowed} values`;
  return null;
};
