import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ItemStatus,
  OverallStatus,
  addDays,
  type RuleSet,
} from '../../02_source/packages/core/src/index.ts';
import { evaluate } from '../../02_source/packages/rules-engine/src/index.ts';
import type { CheckResult, DocumentMeta } from '../../02_source/packages/rules-engine/src/index.ts';
import {
  DEMO_DECISION_DATE,
  EVL_MAX_AGE_DAYS_AS_DOCUMENTED,
  EVL_MAX_AGE_DAYS_RECOMMENDED,
  demoApplication,
  demoDocument,
  salariedRuleSet,
} from './fixtures.ts';

/**
 * OQ-7 quantified — the employment verification letter freshness window.
 *
 * BRD §6.2 transcribes the seed value as 30 days but flags it
 * **⚠️ CONTRADICTED**: AMP's published credit policy (evidence E1, Tier A) says
 * an employment letter may be *"dated within the last 60 days"*. The BRD
 * recommends changing the seed to 60 and logging it in §5.3. OQ-7 is the open
 * question asking the business to confirm.
 *
 * This suite does not answer OQ-7 — it prices it. Everything below is measured
 * by running the real engine, so the number handed to the business is the number
 * the product would actually produce, not an estimate.
 *
 * Both windows are exercised through `salariedRuleSet(evlMaxAgeDays)`, the same
 * builder the demo fixtures use, so nothing here depends on a private test rule.
 */

const DECISION = DEMO_DECISION_DATE;
const EVL_RULE_ID = 'PS-EVL-01';

/** Six ages spanning both windows and their shared warning horizons (H = 7). */
const EVL_AGES_AT_DECISION: readonly number[] = [10, 25, 35, 45, 55, 65];

/** Short tenure makes PS-EVL-01 applicable; the demo file's 36 months does not. */
const SHORT_TENURE_ATTRIBUTES = {
  employment_type: 'salaried',
  self_employed: false,
  tenure_months: 6,
  loan_amount: 45_000,
};

/**
 * A Salaried file with every obtainable document present and comfortably fresh,
 * and an employment letter exactly `ageDays` old at the decision date. Any status
 * change between the two windows is therefore attributable to the window alone.
 */
function fileWithEvlAge(ageDays: number): DocumentMeta[] {
  return [
    demoDocument({ id: 'doc-id', documentType: 'government_id', expiryDate: '2030-01-01' }),
    demoDocument({
      id: 'doc-adr',
      documentType: 'address_proof',
      issueDate: addDays(DECISION, -10),
    }),
    demoDocument({
      id: 'doc-psl',
      documentType: 'payslips',
      issueDate: addDays(DECISION, -5),
    }),
    demoDocument({
      id: 'doc-bank',
      documentType: 'bank_statement',
      issueDate: addDays(DECISION, -2),
    }),
    demoDocument({
      id: 'doc-cbr',
      documentType: 'credit_bureau_report',
      issueDate: addDays(DECISION, -2),
    }),
    demoDocument({
      id: 'doc-evl',
      documentType: 'employment_verification_letter',
      issueDate: addDays(DECISION, -ageDays),
    }),
  ];
}

function run(evlMaxAgeDays: number, ageDays: number, warningsAcknowledged = false): CheckResult {
  return evaluate({
    application: demoApplication({ attributes: SHORT_TENURE_ATTRIBUTES }),
    documents: fileWithEvlAge(ageDays),
    rules: salariedRuleSet(evlMaxAgeDays),
    warningsAcknowledged,
  });
}

function evlItem(result: CheckResult) {
  const item = result.items.find((entry) => entry.ruleId === EVL_RULE_ID);
  assert.ok(item, `${EVL_RULE_ID} must be evaluated`);
  return item;
}

function evlMaxAgeOf(rules: RuleSet): number {
  const item = rules.items.find((entry) => entry.rule_id === EVL_RULE_ID);
  assert.ok(item?.freshness, `${EVL_RULE_ID} must be freshness-based`);
  return item.freshness.max_age_days;
}

describe('OQ-7 — the two candidate windows are the ones the BRD names', () => {
  it('seeds the documented 30-day value and the recommended 60-day value', () => {
    assert.equal(evlMaxAgeOf(salariedRuleSet()), EVL_MAX_AGE_DAYS_AS_DOCUMENTED);
    assert.equal(EVL_MAX_AGE_DAYS_AS_DOCUMENTED, 30);
    assert.equal(EVL_MAX_AGE_DAYS_RECOMMENDED, 60);
    assert.ok(
      EVL_MAX_AGE_DAYS_RECOMMENDED > EVL_MAX_AGE_DAYS_AS_DOCUMENTED,
      'the recommendation loosens the window; it is not a tightening',
    );
  });
});

describe('OQ-7 — measured status impact across six letter ages', () => {
  it('disagrees on 4 of 6 sampled ages', () => {
    const documented = EVL_AGES_AT_DECISION.map((age) => evlItem(run(EVL_MAX_AGE_DAYS_AS_DOCUMENTED, age)).status);
    const recommended = EVL_AGES_AT_DECISION.map((age) => evlItem(run(EVL_MAX_AGE_DAYS_RECOMMENDED, age)).status);

    assert.deepEqual(documented, [
      ItemStatus.PRESENT_VALID, //  10 — fresh under both
      ItemStatus.EXPIRING_SOON, //  25 — inside the 23…30 warned range
      ItemStatus.EXPIRED, //      35
      ItemStatus.EXPIRED, //      45
      ItemStatus.EXPIRED, //      55
      ItemStatus.EXPIRED, //      65 — stale under both
    ]);
    assert.deepEqual(recommended, [
      ItemStatus.PRESENT_VALID, //  10
      ItemStatus.PRESENT_VALID, //  25
      ItemStatus.PRESENT_VALID, //  35
      ItemStatus.PRESENT_VALID, //  45
      ItemStatus.EXPIRING_SOON, //  55 — inside the 53…60 warned range
      ItemStatus.EXPIRED, //      65
    ]);

    const changed = documented.filter((status, index) => status !== recommended[index]);
    assert.equal(changed.length, 4);
  });

  it('moves 3 ages from blocking to non-blocking', () => {
    const flipped = EVL_AGES_AT_DECISION.filter((age) => {
      const before = evlItem(run(EVL_MAX_AGE_DAYS_AS_DOCUMENTED, age));
      const after = evlItem(run(EVL_MAX_AGE_DAYS_RECOMMENDED, age));
      return before.status === ItemStatus.EXPIRED && after.status !== ItemStatus.EXPIRED;
    });
    assert.deepEqual(flipped, [35, 45, 55]);
  });

  it('changes the file-level verdict on 4 of 6 sampled ages', () => {
    const verdicts = EVL_AGES_AT_DECISION.map((age) => ({
      age,
      documented: run(EVL_MAX_AGE_DAYS_AS_DOCUMENTED, age).overallStatus,
      recommended: run(EVL_MAX_AGE_DAYS_RECOMMENDED, age).overallStatus,
    }));

    assert.deepEqual(verdicts, [
      { age: 10, documented: OverallStatus.DECISION_READY, recommended: OverallStatus.DECISION_READY },
      { age: 25, documented: OverallStatus.COMPLETE_WITH_WARNINGS, recommended: OverallStatus.DECISION_READY },
      { age: 35, documented: OverallStatus.INCOMPLETE, recommended: OverallStatus.DECISION_READY },
      { age: 45, documented: OverallStatus.INCOMPLETE, recommended: OverallStatus.DECISION_READY },
      { age: 55, documented: OverallStatus.INCOMPLETE, recommended: OverallStatus.COMPLETE_WITH_WARNINGS },
      { age: 65, documented: OverallStatus.INCOMPLETE, recommended: OverallStatus.INCOMPLETE },
    ]);

    assert.equal(
      verdicts.filter((entry) => entry.documented !== entry.recommended).length,
      4,
    );
  });
});

describe('OQ-7 — the business consequence at a single representative age', () => {
  it('turns a 35-day letter from a hard block into Decision-Ready', () => {
    const documented = run(EVL_MAX_AGE_DAYS_AS_DOCUMENTED, 35);
    const recommended = run(EVL_MAX_AGE_DAYS_RECOMMENDED, 35);

    assert.equal(documented.score, 83);
    assert.equal(documented.blockingCount, 1);
    assert.equal(documented.validRequiredCount, 5);
    assert.equal(documented.applicableRequiredCount, 6);
    assert.equal(documented.overallStatus, OverallStatus.INCOMPLETE);

    assert.equal(recommended.score, 100);
    assert.equal(recommended.blockingCount, 0);
    assert.equal(recommended.validRequiredCount, 6);
    assert.equal(recommended.overallStatus, OverallStatus.DECISION_READY);
  });

  it('costs the borrower a document request that the evidence says is unnecessary', () => {
    const documented = evlItem(run(EVL_MAX_AGE_DAYS_AS_DOCUMENTED, 35));
    // The next-action text is what reaches the borrower through the fix pack, so
    // this is the rework the 30-day window manufactures.
    assert.equal(
      documented.nextAction,
      `Upload an employment verification letter issued on or after ${addDays(DECISION, -30)}.`,
    );
    assert.equal(evlItem(run(EVL_MAX_AGE_DAYS_RECOMMENDED, 35)).status, ItemStatus.PRESENT_VALID);
  });

  it('still asks for a fresh letter under the recommended window at 65 days', () => {
    // Guard against reading the recommendation as "stop checking the letter".
    assert.equal(evlItem(run(EVL_MAX_AGE_DAYS_RECOMMENDED, 65)).status, ItemStatus.EXPIRED);
    assert.equal(run(EVL_MAX_AGE_DAYS_RECOMMENDED, 65).blockingCount, 1);
  });
});

describe('OQ-7 — the change is contained to the employment letter', () => {
  it('leaves every other item, and the rule set version, untouched', () => {
    for (const age of EVL_AGES_AT_DECISION) {
      const documented = run(EVL_MAX_AGE_DAYS_AS_DOCUMENTED, age);
      const recommended = run(EVL_MAX_AGE_DAYS_RECOMMENDED, age);

      const othersOf = (result: CheckResult) =>
        JSON.stringify(result.items.filter((entry) => entry.ruleId !== EVL_RULE_ID));

      assert.equal(othersOf(recommended), othersOf(documented));
      assert.deepEqual(documented.countsByStatus.NOT_APPLICABLE, 0);
    }

    // A window change in production is a new rule version, not an edit in place.
    assert.equal(salariedRuleSet(EVL_MAX_AGE_DAYS_RECOMMENDED).version, 1);
  });

  it('does not disturb the demo file, where the letter is not applicable', () => {
    // The PRD §16 walkthrough has 36 months of tenure, so OQ-7 cannot change it.
    const age = 35;
    const documented = evaluate({
      application: demoApplication(),
      documents: fileWithEvlAge(age),
      rules: salariedRuleSet(EVL_MAX_AGE_DAYS_AS_DOCUMENTED),
    });
    assert.equal(evlItem(documented).status, ItemStatus.NOT_APPLICABLE);
  });
});
