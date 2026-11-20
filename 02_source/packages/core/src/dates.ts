/**
 * UTC-midnight integer-day date arithmetic.
 *
 * The engine must be deterministic (TRD TC-02, NFR-02) and free of timezone
 * drift (TRD §17 risk "Timezone/date arithmetic bugs"). Every date is an
 * ISO `YYYY-MM-DD` string interpreted at UTC midnight, and every interval is an
 * integer number of days. No `Date.now()`, no local-time construction.
 */

export type ISODate = string;

const MS_PER_DAY = 86_400_000;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const ms = isoDateToUtcMs(value);
  return !Number.isNaN(ms) && utcMsToISODate(ms) === value;
}

function isoDateToUtcMs(date: ISODate): number {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  return Date.UTC(year, month - 1, day);
}

function utcMsToISODate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`. Negative when `to` precedes `from`. */
export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((isoDateToUtcMs(to) - isoDateToUtcMs(from)) / MS_PER_DAY);
}

export function addDays(date: ISODate, days: number): ISODate {
  return utcMsToISODate(isoDateToUtcMs(date) + days * MS_PER_DAY);
}

export function subtractDays(date: ISODate, days: number): ISODate {
  return addDays(date, -days);
}

/** True when `candidate` is strictly before `reference`. */
export function isBefore(candidate: ISODate, reference: ISODate): boolean {
  return daysBetween(candidate, reference) > 0;
}

export function compareISODate(a: ISODate, b: ISODate): number {
  return isoDateToUtcMs(a) - isoDateToUtcMs(b);
}
