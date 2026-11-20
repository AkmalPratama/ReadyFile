import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_PROCESSING_SLA_DAYS,
  ItemStatus,
  OverallStatus,
  addDays,
  calendarDaySla,
  daysBetween,
  type ISODate,
} from '../../02_source/packages/core/src/index.ts';
import { evaluate } from '../../02_source/packages/rules-engine/src/index.ts';
import type { CheckResult, DocumentMeta } from '../../02_source/packages/rules-engine/src/index.ts';
import {
  DEMO_DECISION_DATE,
  DEMO_SUBMISSION_DATE,
  PROCESSING_SLA_DAYS,
  demoApplication,
  demoDocument,
  salariedRuleSet,
} from './fixtures.ts';

/**
 * Expected decision date and the boundaries measured against it — PRD §10.1,
 * §10.4, pass criteria PC-10, PC-10a, PC-49.
 *
 * The decision date is the whole product. Every freshness number ReadyFile
 * reports is measured at a date that has not happened yet, so the arithmetic
 * that produces it, and the behaviour when it moves, are release gates in their
 * own right.
 */

const SUBMISSION: ISODate = DEMO_SUBMISSION_DATE; // 2026-03-02, a Monday
const DECISION: ISODate = DEMO_DECISION_DATE; //   2026-03-07, a Saturday

describe('PRD §10.1 — expected decision date = submission date + processing SLA', () => {
  it('reproduces the demo application date with the default 5-day SLA', () => {
    assert.equal(PROCESSING_SLA_DAYS, DEFAULT_PROCESSING_SLA_DAYS);
    assert.equal(DEFAULT_PROCESSING_SLA_DAYS, 5);
    assert.equal(calendarDaySla.expectedDecisionDate(SUBMISSION, 5), DECISION);
    assert.equal(daysBetween(SUBMISSION, DECISION), 5);
  });

  it('is calendar-day arithmetic, and the demo decision date falls on a Saturday', () => {
    // PRD §10.1 permits calendar days for MVP provided the UI labels the
    // calculation. Worth knowing before the demo: 2026-03-07 is a weekend day, so
    // a judge who checks a calendar will see it. Business-day SLA is PC-49,
    // stretch, and not implemented.
    assert.equal(new Date(`${DECISION}T00:00:00Z`).getUTCDay(), 6, 'Saturday');
    assert.equal(calendarDaySla.kind, 'calendar_days');
  });

  it('handles a zero SLA, a month boundary and a leap day', () => {
    assert.equal(calendarDaySla.expectedDecisionDate(SUBMISSION, 0), SUBMISSION);
    assert.equal(calendarDaySla.expectedDecisionDate('2026-01-30', 5), '2026-02-04');
    assert.equal(calendarDaySla.expectedDecisionDate('2026-02-27', 5), '2026-03-04');
    // 2028 is a leap year: 27 → 28 → 29 → 1 → 2 → 3 March.
    assert.equal(calendarDaySla.expectedDecisionDate('2028-02-27', 5), '2028-03-03');
  });

  it('handles a year boundary and a long SLA without drifting', () => {
    assert.equal(calendarDaySla.expectedDecisionDate('2026-12-30', 5), '2027-01-04');
    const start = '2026-03-02';
    for (const days of [1, 7, 30, 90, 365]) {
      const result = calendarDaySla.expectedDecisionDate(start, days);
      assert.equal(daysBetween(start, result), days, `${days}-day SLA drifted`);
    }
  });
});

/** Four freshness documents with fixed issue dates, plus one hard-expiry ID.
 *  Issue dates sit 10 days before the submission date so that at the demo
 *  decision date every age is 15 days — inside the 30-day rules and outside their
 *  23…30 warning ranges. */
function datedFile(reference: ISODate): DocumentMeta[] {
  return [
    demoDocument({ id: 'doc-id', documentType: 'government_id', expiryDate: addDays(reference, 50) }),
    demoDocument({ id: 'doc-adr', documentType: 'address_proof', issueDate: addDays(reference, -10) }),
    demoDocument({ id: 'doc-psl', documentType: 'payslips', issueDate: addDays(reference, -10) }),
    demoDocument({ id: 'doc-bank', documentType: 'bank_statement', issueDate: addDays(reference, -10) }),
    demoDocument({ id: 'doc-cbr', documentType: 'credit_bureau_report', issueDate: addDays(reference, -10) }),
  ];
}

function runAt(decisionDate: ISODate): CheckResult {
  return evaluate({
    application: demoApplication({ submissionDate: SUBMISSION, expectedDecisionDate: decisionDate }),
    documents: datedFile(SUBMISSION),
    rules: salariedRuleSet(),
  });
}

function statusesOf(result: CheckResult): Record<string, string> {
  return Object.fromEntries(result.items.map((entry) => [entry.ruleId, entry.status]));
}

describe('PC-10 — moving the decision date re-evaluates every freshness item', () => {
  it('re-evaluates 100% of applicable freshness items when the date moves out 100 days', () => {
    const atDecision = statusesOf(runAt(DECISION));
    const pushed = statusesOf(runAt(addDays(DECISION, 100)));

    // PS-EVL-01 is NOT_APPLICABLE (tenure 36), so four freshness items apply.
    const freshnessRuleIds = ['PS-ADR-01', 'PS-PSL-01', 'PS-BANK-01', 'PS-CBR-01'];
    for (const ruleId of freshnessRuleIds) {
      assert.equal(atDecision[ruleId], ItemStatus.PRESENT_VALID, `${ruleId} baseline`);
      assert.equal(pushed[ruleId], ItemStatus.EXPIRED, `${ruleId} did not re-evaluate`);
    }
    assert.equal(atDecision['PS-EVL-01'], ItemStatus.NOT_APPLICABLE);
    assert.equal(pushed['PS-EVL-01'], ItemStatus.NOT_APPLICABLE, 'a condition, not a date, governs this item');
  });

  it('re-evaluates each item independently, not the file as a whole', () => {
    // Pushing the decision date 30 days ages every document from 15 days to 45.
    // Only the two 30-day rules breach; the 60- and 90-day rules stay valid. A
    // per-file recalculation would move all four together.
    const pushed = statusesOf(runAt(addDays(DECISION, 30)));

    assert.equal(pushed['PS-BANK-01'], ItemStatus.EXPIRED);
    assert.equal(pushed['PS-CBR-01'], ItemStatus.EXPIRED);
    assert.equal(pushed['PS-PSL-01'], ItemStatus.PRESENT_VALID);
    assert.equal(pushed['PS-ADR-01'], ItemStatus.PRESENT_VALID);
  });

  it('moves the hard-expiry item on the same date change', () => {
    const atDecision = statusesOf(runAt(DECISION));
    const pushed = statusesOf(runAt(addDays(DECISION, 100)));

    assert.equal(atDecision['PS-ID-01'], ItemStatus.PRESENT_VALID);
    assert.equal(pushed['PS-ID-01'], ItemStatus.EXPIRED);
  });

  it('moves the score, the blocking count and the overall status with it', () => {
    const atDecision = runAt(DECISION);
    const pushed = runAt(addDays(DECISION, 100));

    assert.equal(atDecision.score, 100);
    assert.equal(atDecision.blockingCount, 0);
    assert.equal(atDecision.overallStatus, OverallStatus.DECISION_READY);

    assert.equal(pushed.score, 0);
    assert.equal(pushed.blockingCount, 5);
    assert.equal(pushed.overallStatus, OverallStatus.INCOMPLETE);
  });

  it('moves the decision date backwards too — a corrected SLA un-expires documents', () => {
    const baseline = JSON.stringify(runAt(DECISION));

    const pushed = statusesOf(runAt(addDays(DECISION, 100)));
    assert.equal(pushed['PS-BANK-01'], ItemStatus.EXPIRED);

    const restored = runAt(DECISION);
    assert.equal(statusesOf(restored)['PS-BANK-01'], ItemStatus.PRESENT_VALID);
    // The engine holds no state between runs, so the pushed evaluation in the
    // middle cannot contaminate the one that follows it.
    assert.equal(JSON.stringify(restored), baseline);
  });
});

describe('PC-10a — hard-expiry boundaries measured at the decision date', () => {
  function idStatus(expiryDate: ISODate): string {
    const result = evaluate({
      application: demoApplication({ expectedDecisionDate: DECISION }),
      documents: [demoDocument({ id: 'doc-id', documentType: 'government_id', expiryDate })],
      rules: salariedRuleSet(),
    });
    return statusesOf(result)['PS-ID-01']!;
  }

  it('expiry before the decision date is EXPIRED', () => {
    assert.equal(idStatus(addDays(DECISION, -1)), ItemStatus.EXPIRED);
    assert.equal(idStatus('2020-01-01'), ItemStatus.EXPIRED);
  });

  it('expiry equal to the decision date is EXPIRING_SOON — valid that day, no margin', () => {
    // PRD §10.4 and TRD §7.3 step 3 both specify equality, not a window. Widening
    // it to the 7-day warning horizon would flag IDs expiring weeks after
    // approval; TRD §15.1 records that asymmetry as deliberate.
    assert.equal(idStatus(DECISION), ItemStatus.EXPIRING_SOON);
  });

  it('expiry after the decision date is PRESENT_VALID, with no warning window', () => {
    assert.equal(idStatus(addDays(DECISION, 1)), ItemStatus.PRESENT_VALID);
    assert.equal(idStatus(addDays(DECISION, 6)), ItemStatus.PRESENT_VALID, 'inside the freshness horizon, but hard expiry warns on equality only');
    assert.equal(idStatus(addDays(DECISION, 7)), ItemStatus.PRESENT_VALID);
  });
});

describe('PC-49 (stretch) — business-day SLA is not implemented', () => {
  it('does not exclude weekends, and the interface is the seam that would', () => {
    // 2026-03-02 is a Monday. Five *business* days would land on Monday
    // 2026-03-09; five calendar days land on Saturday 2026-03-07.
    assert.equal(calendarDaySla.expectedDecisionDate(SUBMISSION, 5), '2026-03-07');
    assert.notEqual(calendarDaySla.expectedDecisionDate(SUBMISSION, 5), '2026-03-09');

    // TRD AD-07 isolates the arithmetic behind SlaCalculator, so the stretch
    // upgrade is a new object rather than an engine change. Nothing else in the
    // codebase references calendarDaySla's internals.
    assert.deepEqual(Object.keys(calendarDaySla).sort(), ['expectedDecisionDate', 'kind']);
  });
});
