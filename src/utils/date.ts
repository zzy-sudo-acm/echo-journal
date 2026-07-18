/**
 * Date utility functions that always use LOCAL timezone.
 *
 * The bug: `new Date().toISOString().slice(0, 10)` returns UTC date,
 * not local date. If you're in UTC+8 and it's 00:30 (just past midnight),
 * UTC is still the previous day. This breaks "today", calendar, on-this-day,
 * markdown grouping, and daily snapshots.
 *
 * All functions below use local date components exclusively.
 */

/** Return YYYY-MM-DD for the given date in the user's LOCAL timezone. */
export function getLocalDateString(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse YYYY-MM-DD as a stable LOCAL calendar date without UTC coercion. */
export function parseLocalDateString(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

/** Format a YYYY-MM-DD value without relying on the Date string parser. */
export function formatLocalDateString(
  value: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return parseLocalDateString(value).toLocaleDateString('zh-CN', options)
}

/** Return HH:mm in local timezone. */
export function getLocalTimeString(d: Date = new Date()): string {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

/** Return an ISO-like string but in local timezone (YYYY-MM-DDTHH:mm:ss). */
export function getLocalISOString(d: Date = new Date()): string {
  const date = getLocalDateString(d)
  const time = d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  return `${date}T${time}`
}

/**
 * Check if a date belongs to the local "today".
 * Uses local date components, NOT UTC.
 */
export function isToday(d: Date): boolean {
  return getLocalDateString(d) === getLocalDateString()
}

/**
 * Parse an ISO 8601 string and return the LOCAL date part (YYYY-MM-DD).
 * Works for both UTC ISO strings (2024-01-15T10:00:00.000Z) and
 * offset strings (2024-01-15T10:00:00+08:00).
 */
export function toLocalDate(isoString: string): string {
  const d = new Date(isoString)
  return getLocalDateString(d)
}

/**
 * Format a date for display in zh-CN locale.
 */
export function formatDateZh(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Format a date with weekday for zh-CN display.
 */
export function formatDateWithWeekday(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })
}

/**
 * Format time in zh-CN locale.
 */
export function formatTimeZh(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
