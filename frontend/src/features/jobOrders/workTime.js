// How long the people given a master value's work have, and when it is due.
// The units match backend/constants/jobOrderConstants.js DURATION_UNITS.

export const DURATION_UNITS = [
  { value: 'seconds', label: 'Seconds' },
  { value: 'minutes', label: 'Minutes' },
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
  { value: 'months', label: 'Months' },
  { value: 'years', label: 'Years' },
];
export const DURATION_AMOUNT_MAX = 9999;

/** "2 days", "1 hour". */
export const durationTextOf = ({ amount, unit }) => `${amount} ${amount === 1 ? unit.slice(0, -1) : unit}`;

/** "24 Oct 2026, 05:00 pm". */
export const formatDueAt = (value) =>
  new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const STEPS = [
  { unit: 'year', ms: 365 * 24 * 3600e3 },
  { unit: 'month', ms: 30 * 24 * 3600e3 },
  { unit: 'day', ms: 24 * 3600e3 },
  { unit: 'hour', ms: 3600e3 },
  { unit: 'minute', ms: 60e3 },
];

/**
 * A span of time, roughly, in the two biggest units: "2 days 3 hours",
 * "40 minutes" - or null when under a minute.
 * @param {number} ms
 */
export const spanTextOf = (ms) => {
  let left = ms;
  const parts = [];
  for (const step of STEPS) {
    const count = Math.floor(left / step.ms);
    if (count > 0 || parts.length > 0) {
      if (count > 0) parts.push(`${count} ${step.unit}${count === 1 ? '' : 's'}`);
      left -= count * step.ms;
      if (parts.length === 2 || (parts.length > 0 && count === 0)) break;
    }
  }
  return parts.length > 0 ? parts.join(' ') : null;
};

/**
 * How much time is left: "2 days 3 hours left", "40 minutes left", "Less
 * than a minute left" - or "Overdue".
 * @returns {{ text: string, isOverdue: boolean }}
 */
export const timeLeftOf = (dueAt, now = Date.now()) => {
  const left = new Date(dueAt).getTime() - now;
  if (left <= 0) return { text: 'Overdue', isOverdue: true };
  const span = spanTextOf(left);
  return { text: span ? `${span} left` : 'Less than a minute left', isOverdue: false };
};

/**
 * Where someone's work stands against its time, for a badge: completed on
 * time / late (by how much), the time left / Overdue, not counting yet (the
 * time starts on their first step) or no deadline.
 *
 * @param {{ dueAt, timeStartsOn, completeIn, startedAt, step }} work - step: their current step or null
 * @returns {{ text: string, variant: 'green'|'red'|'blue'|'gray'|'yellow', isCompleted?: boolean, hasDeadline?: boolean }}
 *   Completed without a deadline (hasDeadline false): just "Completed" - the step badge already says it
 */
export const timeStatusOf = ({ dueAt, timeStartsOn, completeIn, startedAt, step }, now = Date.now()) => {
  if (step?.fixedStep === 'completed') {
    if (!dueAt) return { text: 'Completed', variant: 'green', isCompleted: true, hasDeadline: false };
    const late = new Date(step.at).getTime() - new Date(dueAt).getTime();
    if (late <= 0) return { text: 'Completed on time', variant: 'green', isCompleted: true, hasDeadline: true };
    const span = spanTextOf(late);
    return { text: span ? `Completed late by ${span}` : 'Completed just late', variant: 'yellow', isCompleted: true, hasDeadline: true };
  }
  if (dueAt) {
    const left = timeLeftOf(dueAt, now);
    return { text: left.text, variant: left.isOverdue ? 'red' : 'blue' };
  }
  if (timeStartsOn === 'onFirstStep' && completeIn && !startedAt) return { text: `${durationTextOf(completeIn)} from the first step`, variant: 'gray' };
  return { text: 'No deadline', variant: 'gray' };
};
