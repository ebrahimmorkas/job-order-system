import { formatDay } from '../../components/common/DateRangeFields';

/**
 * Where today is in a date range ('YYYY-MM-DD'; endDate null = no end):
 * 'upcoming' (not started), 'current', or 'ended'.
 */
export const rangeStateOf = ({ startDate, endDate }, today) => {
  if (startDate > today) return 'upcoming';
  if (endDate && endDate < today) return 'ended';
  return 'current';
};

/** "From 01 Nov 2026", "Until 30 Nov 2026", "01 Nov 2026 - 30 Nov 2026" or "No end". */
export const describeRange = ({ startDate, endDate }, today) => {
  const starts = startDate > today;
  if (starts && endDate) return `${formatDay(startDate)} - ${formatDay(endDate)}`;
  if (starts) return `From ${formatDay(startDate)}`;
  if (endDate) return `Until ${formatDay(endDate)}`;
  return 'No end';
};
