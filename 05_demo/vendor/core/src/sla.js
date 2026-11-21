import { addDays } from "./dates.js";
export const calendarDaySla = {
    kind: 'calendar_days',
    expectedDecisionDate: (submissionDate, slaDays) => addDays(submissionDate, slaDays),
};
