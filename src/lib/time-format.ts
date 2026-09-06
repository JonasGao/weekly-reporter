/** Browser-locale date and relative-time formatting helpers. */
export function toValidDate(value: Date | string | number): Date | null {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatSystemDateTime(value: Date | string | number): string {
  const date = toValidDate(value)
  if (!date) return 'Invalid date'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function formatSystemDate(value: Date | string | number): string {
  const date = toValidDate(value)
  if (!date) return 'Invalid date'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

export function formatSystemRelativeTime(value: Date | string | number, now = Date.now()): string {
  const date = toValidDate(value)
  if (!date) return 'Invalid date'
  const diffSeconds = (date.getTime() - now) / 1000
  const absolute = Math.abs(diffSeconds)
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31536000], ['month', 2592000], ['day', 86400],
    ['hour', 3600], ['minute', 60], ['second', 1],
  ]
  const [unit, size] = units.find(([, seconds]) => absolute >= seconds) ?? units.at(-1)!
  return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(
    Math.round(diffSeconds / size), unit,
  )
}

export function formatSystemWeekday(date: Date, width: 'short' | 'narrow' = 'narrow'): string {
  const validDate = toValidDate(date)
  return validDate
    ? new Intl.DateTimeFormat(undefined, { weekday: width }).format(validDate)
    : 'Invalid date'
}
