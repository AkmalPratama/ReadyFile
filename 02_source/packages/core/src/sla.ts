import { addDays, type ISODate } from './dates.ts';

/**
 * SLA calculation behind an interface (TRD AD-07).
 *
 * The MVP uses calendar days (PRD §10.1). Isolating it here means the stretch
 * business-day implementation (PC-49) is a new object, not an engine change —
 * the engine only ever receives an already-computed expected decision date.
 */
export interface SlaCalculator {
  readonly kind: string;
  expectedDecisionDate(submissionDate: ISODate, slaDays: number): ISODate;
}

export const calendarDaySla: SlaCalculator = {
  kind: 'calendar_days',
  expectedDecisionDate: (submissionDate, slaDays) => addDays(submissionDate, slaDays),
};
