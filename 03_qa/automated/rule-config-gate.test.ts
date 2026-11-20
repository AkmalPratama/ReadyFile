import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_WARNING_HORIZON_DAYS,
  ItemStatus,
  RuleItemSchema,
  RuleSetSchema,
  type RuleItem,
  type RuleSet,
} from '../../02_source/packages/core/src/index.ts';
import { evaluate } from '../../02_source/packages/rules-engine/src/index.ts';
import {
  ALL_PRODUCT_RULE_SETS,
  SANDBOX_BANK_STATEMENT_MAX_AGE_DAYS,
  demoApplication,
  demoDocumentsAtStep2,
  salariedRuleSet,
  salariedRuleSetWithSandboxChange,
} from './fixtures.ts';

/**
 * The rule-configuration gate — PC-25, exception E-20, TRD §7.6 and §8.
 *
 * `RuleSetSchema` is the only thing standing between a policy author editing JSON
 * and the engine trusting that JSON. The engine deliberately performs no
 * defensive checks, so anything the schema lets through is a correctness
 * guarantee the engine will rely on. These tests attack the gate directly.
 *
 * Two real limitations are asserted here rather than hidden: unknown keys are
 * silently stripped (a typo'd field name is ignored, not rejected), and version
 * sequencing has no schema-level enforcement because a schema sees one record at
 * a time. Both belong to the API/persistence layer, which is **not built**.
 */

const VALID_ITEM: RuleItem = {
  rule_id: 'PS-BANK-01',
  document_type: 'bank_statement',
  requirement: 'required',
  condition: null,
  freshness: { kind: 'max_age', max_age_days: 30 },
  hard_expiry: false,
};

/** Deliberately untyped: these tests feed the schema values it must reject. */
function ruleSetWith(item: Record<string, unknown>): unknown {
  return {
    product_id: 'personal_salaried',
    version: 1,
    warning_horizon_days: DEFAULT_WARNING_HORIZON_DAYS,
    items: [{ ...VALID_ITEM, ...item }],
  };
}

function assertRejected(input: unknown, expectedFragment: string): void {
  const parsed = RuleSetSchema.safeParse(input);
  assert.equal(parsed.success, false, `expected rejection, got ${JSON.stringify(input)}`);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((issue) => issue.message).join(' | ');
    assert.ok(
      messages.includes(expectedFragment),
      `expected an issue mentioning "${expectedFragment}", got: ${messages}`,
    );
  }
}

describe('PC-25 — the gate accepts the rule sets the products actually use', () => {
  it('accepts all three product rule sets', () => {
    for (const rules of ALL_PRODUCT_RULE_SETS) {
      const parsed = RuleSetSchema.safeParse(rules);
      assert.equal(parsed.success, true, `${rules.product_id} must parse`);
    }
  });

  it('accepts the sandboxed variant, which is also an author edit', () => {
    assert.equal(RuleSetSchema.safeParse(salariedRuleSetWithSandboxChange()).success, true);
  });

  it('accepts an item carrying both a freshness and a hard-expiry basis', () => {
    assert.equal(
      RuleItemSchema.safeParse({ ...VALID_ITEM, hard_expiry: true }).success,
      true,
    );
  });
});

describe('PC-25 — the gate rejects configurations the engine cannot evaluate', () => {
  it('rejects a rule with neither a freshness nor a hard-expiry basis', () => {
    assertRejected(
      ruleSetWith({ freshness: null, hard_expiry: false }),
      'a rule needs at least one of freshness or hard_expiry',
    );
  });

  it('rejects a conditional rule that names no condition', () => {
    assertRejected(
      ruleSetWith({ requirement: 'conditional', condition: null }),
      "condition is required when requirement is 'conditional'",
    );
  });

  it('rejects a required rule that carries a condition', () => {
    assertRejected(
      ruleSetWith({
        requirement: 'required',
        condition: { field: 'tenure_months', op: '<', value: 12 },
      }),
      "condition must be null when requirement is 'required'",
    );
  });

  it('rejects a rule_id outside the XX-YYYY-NN pattern', () => {
    for (const bad of ['bank-01', 'PSBANK01', 'PS-BANK-1', 'PS-BANK-001', 'ps-bank-01', '']) {
      assertRejected(ruleSetWith({ rule_id: bad }), 'rule_id must match XX-YYYY-NN');
    }
  });

  it('rejects an unknown document type', () => {
    const parsed = RuleSetSchema.safeParse(ruleSetWith({ document_type: 'pay_slip' }));
    assert.equal(parsed.success, false);
  });

  it('rejects a duplicate rule_id within one set', () => {
    assertRejected(
      {
        product_id: 'personal_salaried',
        version: 1,
        warning_horizon_days: DEFAULT_WARNING_HORIZON_DAYS,
        items: [VALID_ITEM, VALID_ITEM],
      },
      "duplicate rule_id 'PS-BANK-01'",
    );
  });

  it('rejects an empty item list and a non-positive version', () => {
    assert.equal(
      RuleSetSchema.safeParse({
        product_id: 'personal_salaried',
        version: 1,
        warning_horizon_days: DEFAULT_WARNING_HORIZON_DAYS,
        items: [],
      }).success,
      false,
    );
    for (const version of [0, -1, 1.5]) {
      assert.equal(
        RuleSetSchema.safeParse({ ...salariedRuleSet(), version }).success,
        false,
        `version ${version} must be rejected`,
      );
    }
  });

  it('rejects a warning horizon outside 0…90 days', () => {
    for (const horizon of [-1, 91, 1_000]) {
      assert.equal(
        RuleSetSchema.safeParse({ ...salariedRuleSet(), warning_horizon_days: horizon }).success,
        false,
        `warning_horizon_days ${horizon} must be rejected`,
      );
    }
    for (const horizon of [0, 90]) {
      assert.equal(
        RuleSetSchema.safeParse({ ...salariedRuleSet(), warning_horizon_days: horizon }).success,
        true,
        `warning_horizon_days ${horizon} is in range`,
      );
    }
  });

  it('rejects a non-integer or negative max_age_days', () => {
    for (const maxAge of [-1, 0.5, Number.NaN]) {
      assert.equal(
        RuleItemSchema.safeParse({
          ...VALID_ITEM,
          freshness: { kind: 'max_age', max_age_days: maxAge },
        }).success,
        false,
        `max_age_days ${maxAge} must be rejected`,
      );
    }
    assert.equal(
      RuleItemSchema.safeParse({
        ...VALID_ITEM,
        freshness: { kind: 'max_age', max_age_days: 0 },
      }).success,
      true,
      'max_age_days 0 means "must be issued on the decision date", which is valid',
    );
  });
});

describe('PC-25 — defaults are applied, so the engine never sees undefined', () => {
  it('defaults warning_horizon_days to 7 when the author omits it', () => {
    const { warning_horizon_days: _omitted, ...rest } = salariedRuleSet();
    const parsed = RuleSetSchema.parse(rest);
    assert.equal(parsed.warning_horizon_days, DEFAULT_WARNING_HORIZON_DAYS);
    assert.equal(DEFAULT_WARNING_HORIZON_DAYS, 7);
  });
});

describe('Known limitation — unknown keys are stripped, not rejected', () => {
  it('silently drops a misspelled rule-set field and applies the default instead', () => {
    // An author who misspells the field believes they widened the warning window
    // to 45 days. The schema accepts the record, discards the typo, and the engine
    // runs with 7. Nothing in the output signals that the edit was lost.
    const parsed = RuleSetSchema.safeParse({
      ...salariedRuleSet(),
      warn_horizon_days: 45,
    });

    assert.equal(parsed.success, true, 'the typo is accepted — this is the limitation');
    if (parsed.success) {
      assert.equal(parsed.data.warning_horizon_days, DEFAULT_WARNING_HORIZON_DAYS);
      assert.equal('warn_horizon_days' in parsed.data, false);
    }
  });

  it('silently drops a misspelled max_age placed at the item level', () => {
    const parsed = RuleItemSchema.safeParse({ ...VALID_ITEM, max_age_days: 45 });

    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.freshness?.max_age_days, 30, 'the nested value wins; the typo is gone');
      assert.equal('max_age_days' in parsed.data, false);
    }
  });

  it('would be closed by .strict(), which the MVP schema does not use', () => {
    // Documented so the fix is a one-line change when the API layer lands, rather
    // than a re-investigation.
    const strict = RuleSetSchema.strict();
    assert.equal(strict.safeParse({ ...salariedRuleSet(), warn_horizon_days: 45 }).success, false);
    assert.equal(strict.safeParse(salariedRuleSet()).success, true);
  });
});

describe('E-20 — version sequencing is not enforceable at the schema level', () => {
  it('accepts a version lower than one already published', () => {
    // A schema sees one record at a time, so it cannot know that version 5 exists.
    // E-20 ("a new rule version must not reuse or precede a published version")
    // therefore has to be enforced by the API against the stored history.
    const publishedLater = RuleSetSchema.safeParse({ ...salariedRuleSet(), version: 1 });
    const publishedEarlier = RuleSetSchema.safeParse({ ...salariedRuleSet(), version: 5 });

    assert.equal(publishedLater.success, true);
    assert.equal(publishedEarlier.success, true);
  });

  it('does enforce the sandbox rule that an edit is a new version, not a mutation', () => {
    const original = salariedRuleSet();
    const edited = salariedRuleSetWithSandboxChange();

    assert.equal(edited.version, original.version + 1);
    // The published version is untouched — history is never rewritten.
    const bankOf = (rules: RuleSet) =>
      rules.items.find((entry) => entry.rule_id === 'PS-BANK-01')?.freshness?.max_age_days;
    assert.equal(bankOf(original), 30);
    assert.equal(bankOf(edited), SANDBOX_BANK_STATEMENT_MAX_AGE_DAYS);
    assert.equal(original.version, 1);
  });
});

describe('Rule-change agility — the engine half of the < 2 minute budget', () => {
  it('re-evaluates a seeded file under a changed rule in well under the budget', () => {
    const documents = demoDocumentsAtStep2();
    const before = evaluate({
      application: demoApplication(),
      documents,
      rules: salariedRuleSet(),
    });

    // PRD §16 step 4: the statement is Expired at the decision date under 30 days.
    const bankBefore = before.items.find((entry) => entry.ruleId === 'PS-BANK-01');
    assert.equal(bankBefore?.status, ItemStatus.EXPIRED);

    const edited = salariedRuleSetWithSandboxChange();
    for (let index = 0; index < 200; index += 1) {
      evaluate({ application: demoApplication(), documents, rules: edited });
    }

    const samples: number[] = [];
    for (let index = 0; index < 50; index += 1) {
      const started = process.hrtime.bigint();
      evaluate({ application: demoApplication(), documents, rules: edited });
      samples.push(Number(process.hrtime.bigint() - started) / 1e6);
    }
    samples.sort((a, b) => a - b);
    const medianMs = samples[Math.floor(samples.length / 2)]!;

    // TRD §7.3 budget is 10 ms per check. The bound here is deliberately looser so
    // a slow CI runner fails on a real regression, not on noise; the measured
    // median is reported in qa-report.md.
    assert.ok(medianMs < 100, `median re-evaluation took ${medianMs} ms`);

    const after = evaluate({
      application: demoApplication(),
      documents,
      rules: edited,
    });
    assert.equal(
      after.items.find((entry) => entry.ruleId === 'PS-BANK-01')?.status,
      ItemStatus.PRESENT_VALID,
      'the statement is 32 days old at the decision date, inside the new 45-day window',
    );
    assert.equal(after.score, before.score + 20);
  });

  it('confirms the change is data, not code — no rebuild is involved', () => {
    const edited = salariedRuleSetWithSandboxChange();
    assert.equal(RuleSetSchema.safeParse(edited).success, true);
    assert.equal(
      edited.items.find((entry) => entry.rule_id === 'PS-BANK-01')?.freshness?.max_age_days,
      SANDBOX_BANK_STATEMENT_MAX_AGE_DAYS,
    );
  });
});
