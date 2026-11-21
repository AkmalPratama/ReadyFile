/**
 * UTC-midnight integer-day date arithmetic.
 *
 * The engine must be deterministic (TRD TC-02, NFR-02) and free of timezone
 * drift (TRD §17 risk "Timezone/date arithmetic bugs"). Every date is an
 * ISO `YYYY-MM-DD` string interpreted at UTC midnight, and every interval is an
 * integer number of days. No `Date.now()`, no local-time construction.
 */
const MS_PER_DAY = 86_400_000;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export function isISODate(value) {
    if (!ISO_DATE_PATTERN.test(value))
        return false;
    const ms = isoDateToUtcMs(value);
    return !Number.isNaN(ms) && utcMsToISODate(ms) === value;
}
function isoDateToUtcMs(date) {
    const year = Number(date.slice(0, 4));
    const month = Number(date.slice(5, 7));
    const day = Number(date.slice(8, 10));
    return Date.UTC(year, month - 1, day);
}
function utcMsToISODate(ms) {
    return new Date(ms).toISOString().slice(0, 10);
}
/** Whole days from `from` to `to`. Negative when `to` precedes `from`. */
export function daysBetween(from, to) {
    return Math.round((isoDateToUtcMs(to) - isoDateToUtcMs(from)) / MS_PER_DAY);
}
export function addDays(date, days) {
    return utcMsToISODate(isoDateToUtcMs(date) + days * MS_PER_DAY);
}
export function subtractDays(date, days) {
    return addDays(date, -days);
}
/** True when `candidate` is strictly before `reference`. */
export function isBefore(candidate, reference) {
    return daysBetween(candidate, reference) > 0;
}
export function compareISODate(a, b) {
    return isoDateToUtcMs(a) - isoDateToUtcMs(b);
}
