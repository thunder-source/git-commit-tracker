/**
 * Date utility functions
 */

/**
 * Formats a date as an ISO date string (YYYY-MM-DD)
 * @param date Date to format
 * @returns ISO date string
 */
export function formatISODate(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

/**
 * Formats a date as a human-readable string
 * @param date Date to format
 * @returns Human-readable date string
 */
export function formatHumanDate(date: Date = new Date()): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Gets the start of a day
 * @param date Date to get the start of
 * @returns Date object set to the start of the day
 */
export function getStartOfDay(date: Date = new Date()): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * Gets the end of a day
 * @param date Date to get the end of
 * @returns Date object set to the end of the day
 */
export function getEndOfDay(date: Date = new Date()): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Gets the previous day
 * @param date Date to get the previous day of
 * @returns Date object set to the previous day
 */
export function getPreviousDay(date: Date = new Date()): Date {
  const prev = new Date(date);
  prev.setDate(prev.getDate() - 1);
  return prev;
}
