import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ItemStatus, OverallStatus, ReasonCode, addDays, type RuleSet } from '../../02_source/packages/core/src/index.ts';
import { evaluate } from '../../02_source/packages/rules-engine/src/index.ts';
import type { DocumentMeta } from '../../02_source/packages/rules-engine/src/index.ts';
import {
  ALL_PRODUCT_RULE_SETS,
  DEMO_DECISION_DATE,
  demoApplication,
  demoDocument,
  homeLoanRuleSet,
  salariedRuleSet,
  selfEmployedRuleSet,
} from './fixtures.ts';

/**
 * Decision-ready gate enforcement — FR-08, PR-11, handoff H7, exception E-16.
 *
 * PRD H7 defines the Loan Officer → Underwriter gate as: *zero Missing and zero
 * Expired required items, warnings acknowledged*. E-16 requires that the gate be
 * enforced server-side so it cannot be bypassed by editing client state.
 *
 * The engine is that server-side authority for MVP: `overallStatus` is computed
 * here and never in a client. These tests assert the gate cannot be talked out
 * of blocking. UI enforcement (a disabled button) and the API's 409 response are
 * **not built** — see qa-report.md.
 */

const DECISION = DEMO_DECISION_DATE;
const FRESH = addDays(DECISION, -3);

/** Every document a rule set could want, all comfortably valid. */
function allValidDocuments(rules: RuleSet): DocumentMeta[] {
  return rules.items.map((entry, index) =>
    demoDocument({
      id: `doc-${index}`,
      documentType: entry.document_type,
      ...(entry.hard_expiry ? { expiryDate: '2030-01-01' } : { issueDate: FRESH }),
    }),
  );
}

/**
 * Attributes that make every conditional rule in every product applicable, so
 * the gate is tested against the largest possible checklist.
 */
const ALL_CONDITIONS_TRUE = {
  employment_type: 'salaried',
  self_employed: true,
  tenure_months: 3,
  security_type: 'property',
  loan_amount: 250_000,
};

function runWith(rules: RuleSet, omitDocumentType: string, acknowledged: boolean) {
  const documents = allValidDocuments(rules).filter(
    (document) => document.documentType !== omitDocumentType,
  );
  return evaluate({
    application: demoApplication({ attributes: ALL_CONDITIONS_TRUE }),
    documents,
    rules,
    warningsAcknowledged: acknowledged,
  });
}

describe('H7 / PR-11 — one Missing required item blocks in every product', () => {
  const cases: readonly (readonly [string, RuleSet, string])[] = [
    ['personal_salaried', salariedRuleSet(), 'bank_statement'],
    ['personal_self_employed', selfEmployedRuleSet(), 'tax_return'],
    ['home_loan', homeLoanRuleSet(), 'property_valuation_report'],
  ];

  for (const [productId, rules, omitted] of cases) {
    it(`${productId}: omitting ${omitted} yields INCOMPLETE`, () => {
      const result = runWith(rules, omitted, false);
      assert.equal(result.overallStatus, OverallStatus.INCOMPLETE, productId);
      assert.ok(result.blockingCount >= 1);
      const missing = result.items.filter(
        (entry) => entry.status === ItemStatus.MISSING && entry.requirement !== 'optional',
      );
      assert.ok(missing.length >= 1, 'expected at least one Missing required item');
    });
  }
});

describe('E-16 — acknowledging warnings cannot clear a blocker', () => {
  for (const rules of ALL_PRODUCT_RULE_SETS) {
    it(`${rules.product_id} stays INCOMPLETE with warningsAcknowledged = true`, () => {
      const unacknowledged = runWith(rules, 'credit_bureau_report', false);
      const acknowledged = runWith(rules, 'credit_bureau_report', true);

      assert.equal(unacknowledged.overallStatus, OverallStatus.INCOMPLETE);
      assert.equal(acknowledged.overallStatus, OverallStatus.INCOMPLETE);
      assert.equal(
        acknowledged.blockingCount,
        unacknowledged.blockingCount,
        'acknowledgment must not change the blocking count',
      );
      assert.deepEqual(acknowledged.items, unacknowledged.items);
    });
  }

  it('acknowledgment is the only thing that separates warnings from ready', () => {
    // One item inside the warning window, nothing blocking.
    const documents = allValidDocuments(salariedRuleSet()).map((document) =>
      document.documentType === 'bank_statement'
        ? { ...document, issueDate: addDays(DECISION, -28) } // age 28 of 30 → warning
        : document,
    );
    const application = demoApplication({ attributes: ALL_CONDITIONS_TRUE });

    const before = evaluate({
      application,
      documents,
      rules: salariedRuleSet(),
      warningsAcknowledged: false,
    });
    const after = evaluate({
      application,
      documents,
      rules: salariedRuleSet(),
      warningsAcknowledged: true,
    });

    assert.equal(before.overallStatus, OverallStatus.COMPLETE_WITH_WARNINGS);
    assert.equal(after.overallStatus, OverallStatus.DECISION_READY);
    assert.equal(before.warningCount, 1);
    assert.equal(after.warningCount, 1, 'the warning is still reported, just acknowledged');
    // TRD §7.4 — acknowledgment never rewrites item results.
    assert.deepEqual(after.items, before.items);
  });
});

describe('H7 — a fully satisfied checklist is Decision-Ready', () => {
  for (const rules of ALL_PRODUCT_RULE_SETS) {
    it(`${rules.product_id} reaches DECISION_READY with every document valid`, () => {
      const result = evaluate({
        application: demoApplication({ attributes: ALL_CONDITIONS_TRUE }),
        documents: allValidDocuments(rules),
        rules,
        warningsAcknowledged: false,
      });

      assert.equal(result.blockingCount, 0);
      assert.equal(result.warningCount, 0);
      assert.equal(result.score, 100);
      assert.equal(result.overallStatus, OverallStatus.DECISION_READY);
      assert.equal(result.validRequiredCount, result.applicableRequiredCount);
    });
  }
});

describe('Gate integrity — the status is derived, never asserted by the caller', () => {
  it('recomputes the same status from the published counts', () => {
    // A client could try to display DECISION_READY from its own state. The
    // invariant below is what makes that impossible to sustain: the status is a
    // pure function of the counts the engine already published.
    for (const rules of ALL_PRODUCT_RULE_SETS) {
      for (const acknowledged of [false, true]) {
        const result = evaluate({
          application: demoApplication({ attributes: ALL_CONDITIONS_TRUE }),
          documents: allValidDocuments(rules).slice(1),
          rules,
          warningsAcknowledged: acknowledged,
        });
        const expected =
          result.blockingCount > 0
            ? OverallStatus.INCOMPLETE
            : result.warningCount > 0 && !acknowledged
              ? OverallStatus.COMPLETE_WITH_WARNINGS
              : OverallStatus.DECISION_READY;
        assert.equal(result.overallStatus, expected, `${rules.product_id} ack=${acknowledged}`);
      }
    }
  });

  it('never reports DECISION_READY while a required item is Missing or Expired', () => {
    for (const rules of ALL_PRODUCT_RULE_SETS) {
      for (let cut = 0; cut < rules.items.length; cut += 1) {
        const documents = allValidDocuments(rules).slice(0, cut);
        for (const acknowledged of [false, true]) {
          const result = evaluate({
            application: demoApplication({ attributes: ALL_CONDITIONS_TRUE }),
            documents,
            rules,
            warningsAcknowledged: acknowledged,
          });
          const hasBlockingRequired = result.items.some(
            (entry) =>
              entry.requirement !== 'optional' &&
              (entry.status === ItemStatus.MISSING || entry.status === ItemStatus.EXPIRED),
          );
          assert.equal(
            result.overallStatus === OverallStatus.DECISION_READY,
            !hasBlockingRequired,
            `${rules.product_id} with ${cut} documents, ack=${acknowledged}`,
          );
        }
      }
    }
  });
});

/**
 * PC-17 — *"Every MISSING, EXPIRED, EXPIRING_SOON item carries non-empty
 * reason_text and next_action. Threshold 100%."* PR-12 goes further and asks for
 * a reason, a rule ID and a next action on **every** item, so the sweep below
 * asserts all five states, not only the three the criterion names.
 *
 * The sweep is a matrix rather than a sample, because the threshold is 100%:
 * every product × every document state × both acknowledgment states. Document
 * states are built by offset, so one parameter drives a document from valid
 * through the warning window to expired on either basis.
 *
 * `NOT_APPLICABLE` is not reachable here: `ALL_CONDITIONS_TRUE` makes every
 * conditional rule apply, by design, so the gate is tested against the largest
 * possible checklist. That state is covered by the golden suite and by the engine
 * unit matrix (TRD §15.1, rows "Conditional off" and "Optional absent").
 */
describe('PC-17 — every item explains itself, in every state', () => {
  const ACTIONABLE = new Set<string>([
    ItemStatus.MISSING,
    ItemStatus.EXPIRED,
    ItemStatus.EXPIRING_SOON,
  ]);

  /**
   * One document per rule, dated by offset from the decision date. A freshness
   * rule gets `issueDate = decision − offset` (so the offset *is* the age); a
   * hard-expiry rule gets `expiryDate = decision + offset`.
   */
  function documentsAtOffset(rules: RuleSet, offsetDays: number): DocumentMeta[] {
    return rules.items.map((entry, index) =>
      demoDocument({
        id: `doc-${offsetDays}-${index}`,
        documentType: entry.document_type,
        ...(entry.freshness !== null ? { issueDate: addDays(DECISION, -offsetDays) } : {}),
        ...(entry.hard_expiry ? { expiryDate: addDays(DECISION, offsetDays) } : {}),
      }),
    );
  }

  /** Offsets chosen to reach every reason code the sweep can produce: 40 expires
   *  the 30-day rules, 28 warns them, 0 puts a hard expiry exactly on the
   *  decision date, −1 puts one the day before. */
  const STATES: readonly (readonly [string, (rules: RuleSet) => DocumentMeta[]])[] = [
    ['absent', () => []],
    ['valid', (rules) => documentsAtOffset(rules, 3)],
    ['warning', (rules) => documentsAtOffset(rules, 28)],
    ['hard-expiry-on-decision-date', (rules) => documentsAtOffset(rules, 0)],
    ['hard-expiry-passed', (rules) => documentsAtOffset(rules, -1)],
    ['freshness-expired', (rules) => documentsAtOffset(rules, 40)],
    ['partially-present', (rules) => documentsAtOffset(rules, 3).slice(0, Math.ceil(rules.items.length / 2))],
  ];

  function sweep(rules: RuleSet, documents: DocumentMeta[], acknowledged: boolean) {
    return evaluate({
      application: demoApplication({ attributes: ALL_CONDITIONS_TRUE }),
      documents,
      rules,
      warningsAcknowledged: acknowledged,
    });
  }

  it('gives every actionable item a reason and a next action', () => {
    let checked = 0;
    const statesSeen = new Set<string>();
    for (const rules of ALL_PRODUCT_RULE_SETS) {
      for (const [stateName, build] of STATES) {
        for (const acknowledged of [false, true]) {
          for (const item of sweep(rules, build(rules), acknowledged).items) {
            if (!ACTIONABLE.has(item.status)) continue;
            checked += 1;
            statesSeen.add(item.status);
            const where = `${rules.product_id}/${stateName}/${item.ruleId}/${item.status}`;
            assert.ok(item.reasonText.trim().length > 0, `${where}: empty reason_text`);
            assert.ok(item.nextAction.trim().length > 0, `${where}: empty next_action`);
            assert.notEqual(item.reasonCode, ReasonCode.VALID, `${where}: actionable but VALID`);
          }
        }
      }
    }
    // Guards against the sweep passing because it never reached these states.
    assert.deepEqual([...statesSeen].sort(), [
      ItemStatus.EXPIRED,
      ItemStatus.EXPIRING_SOON,
      ItemStatus.MISSING,
    ]);
    assert.ok(checked > 100, `expected a broad sweep, checked ${checked} actionable items`);
  });

  it('gives every item — valid, warning, expired or missing — a reason and a rule ID', () => {
    let checked = 0;
    for (const rules of ALL_PRODUCT_RULE_SETS) {
      const ruleIds = new Set(rules.items.map((entry) => entry.rule_id));
      for (const [, build] of STATES) {
        for (const item of sweep(rules, build(rules), false).items) {
          checked += 1;
          const where = `${rules.product_id}/${item.ruleId}`;
          assert.ok(item.reasonText.trim().length > 0, `${where}: empty reason_text`);
          assert.ok(item.nextAction.trim().length > 0, `${where}: empty next_action`);
          // PC-18's resolvability, at the engine layer: every rule_id in a result
          // exists in the rule version that produced it.
          assert.ok(ruleIds.has(item.ruleId), `${where}: not in the rule set`);
        }
      }
    }
    assert.equal(checked, (6 + 6 + 9) * STATES.length, 'every checklist was swept in every state');
  });

  it('reaches every reason code the engine can emit under these fixtures', () => {
    // A reason code with no reachable path is a dead branch — the way
    // OPTIONAL_NOT_REQUIRED was before DEF-01. CONDITION_NOT_MET and
    // CONDITION_ATTRIBUTE_MISSING are excluded because ALL_CONDITIONS_TRUE
    // satisfies every conditional by construction; the golden suite drives those
    // two directly.
    const seen = new Set<string>();
    for (const rules of ALL_PRODUCT_RULE_SETS) {
      for (const [, build] of STATES) {
        for (const item of sweep(rules, build(rules), false).items) {
          seen.add(item.reasonCode);
        }
      }
    }
    for (const code of [
      ReasonCode.VALID,
      ReasonCode.NO_DOCUMENT,
      ReasonCode.FRESHNESS_AT_DECISION,
      ReasonCode.EXPIRING_SOON_FRESHNESS,
      ReasonCode.HARD_EXPIRY_PASSED,
      ReasonCode.EXPIRING_SOON_HARD_EXPIRY,
    ]) {
      assert.ok(seen.has(code), `${code} was never produced by the sweep`);
    }
  });
});
