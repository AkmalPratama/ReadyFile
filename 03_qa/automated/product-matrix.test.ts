import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DOCUMENT_TYPES,
  ItemStatus,
  OverallStatus,
  RuleSetSchema,
  addDays,
  type DocumentType,
  type RuleItem,
  type RuleSet,
} from '../../02_source/packages/core/src/index.ts';
import { evaluate } from '../../02_source/packages/rules-engine/src/index.ts';
import type { DocumentMeta } from '../../02_source/packages/rules-engine/src/index.ts';
import {
  ALL_PRODUCT_RULE_SETS,
  PRODUCT_HOME_LOAN,
  PRODUCT_SALARIED,
  PRODUCT_SELF_EMPLOYED,
  demoApplication,
  demoDocument,
  homeLoanRuleSet,
  salariedRuleSet,
  selfEmployedRuleSet,
} from './fixtures.ts';

/**
 * Structural conformance of the three demo products against PRD §11 / BRD §6.2.
 *
 * These tests read the published matrix as the source of truth and assert the
 * fixtures reproduce it exactly — including which document types are *Not
 * applicable* to each product, which the rule set expresses by omission.
 *
 * Also contains the reproduction for **DEF-06**, a defect in the published
 * matrix itself rather than in the code.
 */

/** PRD §11 cells reading "Not applicable", per product. */
const NOT_APPLICABLE_BY_PRODUCT: Readonly<Record<string, readonly DocumentType[]>> = {
  [PRODUCT_SALARIED]: [
    'tax_return',
    'business_registration',
    'property_valuation_report',
    'insurance_certificate',
  ],
  [PRODUCT_SELF_EMPLOYED]: [
    'payslips',
    'employment_verification_letter',
    'property_valuation_report',
    'insurance_certificate',
  ],
  [PRODUCT_HOME_LOAN]: ['business_registration'],
};

/** PRD §11 cells reading "Conditional". */
const CONDITIONAL_BY_PRODUCT: Readonly<Record<string, readonly DocumentType[]>> = {
  [PRODUCT_SALARIED]: ['employment_verification_letter'],
  [PRODUCT_SELF_EMPLOYED]: [],
  [PRODUCT_HOME_LOAN]: ['tax_return', 'employment_verification_letter', 'insurance_certificate'],
};

const RULE_ID_PREFIX: Readonly<Record<string, string>> = {
  [PRODUCT_SALARIED]: 'PS',
  [PRODUCT_SELF_EMPLOYED]: 'SE',
  [PRODUCT_HOME_LOAN]: 'HL',
};

function rulesFor(rules: RuleSet): Readonly<Record<string, RuleItem>> {
  return Object.fromEntries(rules.items.map((entry) => [entry.document_type, entry]));
}

describe('PC-25 — every product rule set passes the save-time schema gate', () => {
  for (const rules of ALL_PRODUCT_RULE_SETS) {
    it(`accepts ${rules.product_id}`, () => {
      const parsed = RuleSetSchema.safeParse(rules);
      assert.equal(parsed.success, true, JSON.stringify(parsed.error?.issues ?? []));
    });
  }

  it('gives each product a distinct, pattern-valid rule_id prefix', () => {
    for (const rules of ALL_PRODUCT_RULE_SETS) {
      const expectedPrefix = RULE_ID_PREFIX[rules.product_id];
      assert.ok(expectedPrefix, `no prefix recorded for ${rules.product_id}`);
      for (const entry of rules.items) {
        assert.ok(
          entry.rule_id.startsWith(`${expectedPrefix}-`),
          `${entry.rule_id} does not use the ${expectedPrefix} prefix`,
        );
        assert.match(entry.rule_id, /^[A-Z]{2}-[A-Z]+-\d{2}$/);
      }
      const ids = rules.items.map((entry) => entry.rule_id);
      assert.equal(new Set(ids).size, ids.length, `duplicate rule_id in ${rules.product_id}`);
    }
  });
});

describe('PRD §11 — rule sets and Not-applicable cells partition the document registry', () => {
  for (const rules of ALL_PRODUCT_RULE_SETS) {
    it(`${rules.product_id} covers every document type exactly once`, () => {
      const notApplicable = NOT_APPLICABLE_BY_PRODUCT[rules.product_id] ?? [];
      const covered = rules.items.map((entry) => entry.document_type);

      // A rule set that silently dropped a row, or invented a document type,
      // would pass a looser assertion. The partition must be exact.
      assert.equal(
        covered.length + notApplicable.length,
        DOCUMENT_TYPES.length,
        `${rules.product_id}: ${covered.length} rules + ${notApplicable.length} not-applicable ≠ ${DOCUMENT_TYPES.length} registry entries`,
      );
      assert.equal(
        new Set([...covered, ...notApplicable]).size,
        DOCUMENT_TYPES.length,
        `${rules.product_id}: a document type is both ruled and not-applicable, or is missing`,
      );
      for (const documentType of notApplicable) {
        assert.equal(
          covered.includes(documentType),
          false,
          `${rules.product_id} has a rule for ${documentType}, which PRD §11 marks Not applicable`,
        );
      }
    });
  }
});

describe('PRD §11 — requirement levels match the matrix', () => {
  for (const rules of ALL_PRODUCT_RULE_SETS) {
    it(`${rules.product_id} marks exactly the Conditional cells as conditional`, () => {
      const expectedConditional = CONDITIONAL_BY_PRODUCT[rules.product_id] ?? [];
      const actualConditional = rules.items
        .filter((entry) => entry.requirement === 'conditional')
        .map((entry) => entry.document_type)
        .sort();

      assert.deepEqual(actualConditional, [...expectedConditional].sort());
      for (const entry of rules.items) {
        const shouldBeConditional = expectedConditional.includes(entry.document_type);
        assert.equal(
          entry.requirement === 'conditional',
          shouldBeConditional,
          `${entry.rule_id} requirement is '${entry.requirement}'`,
        );
        // A conditional rule must carry a condition; a non-conditional must not.
        assert.equal(entry.condition !== null, shouldBeConditional, entry.rule_id);
      }
    });

    it(`${rules.product_id} uses no requirement level outside the matrix vocabulary`, () => {
      for (const entry of rules.items) {
        assert.ok(
          entry.requirement === 'required' || entry.requirement === 'conditional',
          `${entry.rule_id} is '${entry.requirement}'; PRD §11 has no Optional cell for this product`,
        );
      }
    });
  }
});

describe('PRD §11 — freshness and expiry basis per document type', () => {
  /** The "Freshness / expiry rule" column, which is product-independent. */
  const BASIS_BY_TYPE: Readonly<
    Record<DocumentType, { kind: 'hard_expiry' } | { kind: 'max_age'; days: number }>
  > = {
    government_id: { kind: 'hard_expiry' },
    address_proof: { kind: 'max_age', days: 90 },
    payslips: { kind: 'max_age', days: 60 },
    bank_statement: { kind: 'max_age', days: 30 },
    // ASSUMED — see fixtures.ts. The matrix gives no day count for tax returns.
    tax_return: { kind: 'max_age', days: 365 },
    business_registration: { kind: 'hard_expiry' },
    // 30 as documented; the 60-day recommendation is measured separately in
    // evl-window-impact.test.ts because OQ-7 is unresolved.
    employment_verification_letter: { kind: 'max_age', days: 30 },
    property_valuation_report: { kind: 'max_age', days: 180 },
    credit_bureau_report: { kind: 'max_age', days: 30 },
    insurance_certificate: { kind: 'hard_expiry' },
  };

  it('matches the documented basis in all three products', () => {
    for (const rules of ALL_PRODUCT_RULE_SETS) {
      for (const entry of rules.items) {
        const expected = BASIS_BY_TYPE[entry.document_type];
        if (expected.kind === 'hard_expiry') {
          assert.equal(entry.hard_expiry, true, `${entry.rule_id} should require a hard expiry`);
          assert.equal(entry.freshness, null, `${entry.rule_id} should have no freshness window`);
        } else {
          assert.equal(entry.hard_expiry, false, `${entry.rule_id} should not require a hard expiry`);
          assert.equal(
            entry.freshness?.max_age_days,
            expected.days,
            `${entry.rule_id} max_age_days`,
          );
        }
      }
    }
  });
});

// ===========================================================================
// DEF-06 — a defect in the published matrix, not in the code
// ===========================================================================

describe('DEF-06 — a self-employed Home Loan applicant can never be Decision-Ready', () => {
  const decisionDate = addDays('2026-03-02', 5);
  const fresh = addDays(decisionDate, -3);

  /** Every document a self-employed borrower can actually obtain. */
  function selfEmployedHomeLoanDocuments(): DocumentMeta[] {
    return [
      demoDocument({ id: 'hl-id', documentType: 'government_id', expiryDate: '2030-01-01' }),
      demoDocument({ id: 'hl-adr', documentType: 'address_proof', issueDate: fresh }),
      demoDocument({ id: 'hl-bank', documentType: 'bank_statement', issueDate: fresh }),
      demoDocument({ id: 'hl-cbr', documentType: 'credit_bureau_report', issueDate: fresh }),
      demoDocument({ id: 'hl-pvr', documentType: 'property_valuation_report', issueDate: fresh }),
      demoDocument({ id: 'hl-tax', documentType: 'tax_return', issueDate: fresh }),
      demoDocument({ id: 'hl-ins', documentType: 'insurance_certificate', expiryDate: '2027-06-01' }),
      // No payslips: a self-employed applicant does not have them.
    ];
  }

  const application = demoApplication({
    expectedDecisionDate: decisionDate,
    attributes: {
      employment_type: 'self_employed',
      self_employed: true,
      tenure_months: 60,
      security_type: 'property',
      loan_amount: 480_000,
    },
  });

  it('reproduces: HL-PSL-01 stays MISSING and blocks forever', () => {
    const result = evaluate({
      application,
      documents: selfEmployedHomeLoanDocuments(),
      rules: homeLoanRuleSet(),
    });

    const payslips = result.items.find((entry) => entry.ruleId === 'HL-PSL-01');
    assert.equal(payslips?.status, ItemStatus.MISSING);
    assert.equal(result.overallStatus, OverallStatus.INCOMPLETE);
    assert.equal(result.blockingCount, 1);
    // Every obtainable document is present and valid, yet the score is capped.
    assert.equal(result.validRequiredCount, 7);
    assert.equal(result.applicableRequiredCount, 8);
    assert.equal(result.score, 88);
  });

  it('shows the root cause: tax returns are Conditional but payslips are not', () => {
    const byType = rulesFor(homeLoanRuleSet());
    assert.equal(byType['tax_return']?.requirement, 'conditional');
    assert.equal(byType['payslips']?.requirement, 'required');
    // The matrix conditions one income-evidence document on self_employment and
    // leaves the other unconditional, so exactly one of the two is always
    // unobtainable for any given applicant.
    assert.equal(byType['payslips']?.condition, null);
  });

  it('is fixed by making payslips conditional on salaried employment', () => {
    const patched: RuleSet = {
      ...homeLoanRuleSet(),
      version: 2,
      items: homeLoanRuleSet().items.map((entry) =>
        entry.rule_id === 'HL-PSL-01'
          ? {
              ...entry,
              requirement: 'conditional' as const,
              condition: { field: 'self_employed', op: '==' as const, value: false },
            }
          : entry,
      ),
    };

    assert.equal(RuleSetSchema.safeParse(patched).success, true);

    const result = evaluate({
      application,
      documents: selfEmployedHomeLoanDocuments(),
      rules: patched,
    });

    assert.equal(
      result.items.find((entry) => entry.ruleId === 'HL-PSL-01')?.status,
      ItemStatus.NOT_APPLICABLE,
    );
    assert.equal(result.blockingCount, 0);
    assert.equal(result.score, 100);
    assert.equal(result.overallStatus, OverallStatus.DECISION_READY);
  });

  it('does not affect the Salaried or Self-Employed products', () => {
    // Salaried requires payslips and has no tax-return rule; Self-Employed has
    // no payslip rule at all. Only Home Loan carries both income-evidence rows.
    assert.equal(
      salariedRuleSet().items.some((entry) => entry.document_type === 'tax_return'),
      false,
    );
    assert.equal(
      selfEmployedRuleSet().items.some((entry) => entry.document_type === 'payslips'),
      false,
    );
  });
});
