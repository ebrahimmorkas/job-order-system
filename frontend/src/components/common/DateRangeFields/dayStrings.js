// Calendar days as 'YYYY-MM-DD' strings (local time).

const pad = (n) => String(n).padStart(2, '0');

/** A Date (or null) as a calendar day 'YYYY-MM-DD' (or ''), in local time. */
export const toDayString = (date) => (date ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` : '');

/** Today as 'YYYY-MM-DD'. */
export const todayString = () => toDayString(new Date());

/** 'YYYY-MM-DD' -> "23 Oct 2026". */
export const formatDay = (day) =>
  new Date(`${day}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
