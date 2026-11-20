import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DATE_PROVENANCE_OFFICER_ENTRY,
  ItemStatus,
  OverallStatus,
  ReasonCode,
  RuleItemSchema,
  RuleSetSchema,
  addDays,
  daysBetween,
  type ApplicationAttributes,
  type Condition,
  type DocumentType,
  type ISODate,
  type RequirementLevel,
  type RuleItem,
  type RuleSet,
} from '@readyfile/core';
import { evaluate, resolveOverallStatus } from '@readyfile/rules-engine';
import type {
  CheckResult,
  DocumentMeta,
  EvaluationApplication,
  ItemResult,
} from '@readyfile/rules-engine';

/**
 * TRD §15.1 rules-engine unit matrix, in table order.
 *
 * Every `describe` title names the row it implements, so a spec change shows up
 * as a missing or renamed suite rather than a silent gap. Rows marked "added"
 * are the v1.2 additions the implementation surfaced.
 *
 * Every date is an argument. Nothing here may depend on the wall clock, the
 * runtime locale, or object-key/query ordering (TC-02, NFR-02, PC-28).
 */

const PRODUCT_ID = 'personal_salaried';
const RULE_VERSION = 3;
const SUBMISSION_DATE: ISODate = '2026-01-05';
// Submission + the 5-day calendar SLA. The SLA lives on `applications`, not in
// the rule set (TRD §9) — the engine only ever receives the resulting date.
const DECISION_DATE: ISODate = '2026-01-10';
const WARNING_HORIZON_DAYS = 7;
const UPLOADED_AT = '2026-01-05T09:00:00.000Z';

/** Payslip max age. Used for every freshness boundary: M = 60, H = 7. */
const PAYSLIP_MAX_AGE = 60;

// ---------------------------------------------------------------------------
// Builders. `RuleItem.condition` and `RuleItem.freshness` are non-optional
// nullables in the schema, so fixtures always set them explicitly — the shape a
// rule set has after a zod parse (TRD §8).
// ---------------------------------------------------------------------------

interface RuleItemFixture {
  ruleId: string;
  documentType: DocumentType;
  requirement?: RequirementLevel;
  maxAgeDays?: number;
  hardExpiry?: boolean;
  condition?: Condition;
}

function rule(input: RuleItemFixture): RuleItem {
  return {
    rule_id: input.ruleId,
    document_type: input.documentType,
    // Derived, not defaulted: a fixture carrying a condition can never silently
    // become a `required` rule, which RuleItemSchema rejects.
    requirement:
      input.requirement ?? (input.condition !== undefined ? 'conditional' : 'required'),
    condition: input.condition ?? null,
    freshness:
      input.maxAgeDays !== undefined
        ? { kind: 'max_age', max_age_days: input.maxAgeDays }
        : null,
    hard_expiry: input.hardExpiry ?? false,
  };
}

function ruleSet(
  items: readonly RuleItem[],
  overrides: Partial<Pick<RuleSet, 'warning_horizon_days'>> = {},
): RuleSet {
  return {
    product_id: PRODUCT_ID,
    version: RULE_VERSION,
    warning_horizon_days: overrides.warning_horizon_days ?? WARNING_HORIZON_DAYS,
    items: [...items],
  };
}

interface DocumentFixture {
  id: string;
  documentType: DocumentType;
  issueDate?: ISODate | null;
  expiryDate?: ISODate | null;
  uploadedAt?: string;
  version?: number;
}

function doc(input: DocumentFixture): DocumentMeta {
  return {
    id: input.id,
    documentType: input.documentType,
    issueDate: input.issueDate ?? null,
    expiryDate: input.expiryDate ?? null,
    uploadedAt: input.uploadedAt ?? UPLOADED_AT,
    version: input.version ?? 1,
  };
}

function application(
  attributes: ApplicationAttributes,
  overrides: Partial<Pick<EvaluationApplication, 'submissionDate' | 'expectedDecisionDate'>> = {},
): EvaluationApplication {
  return {
    submissionDate: overrides.submissionDate ?? SUBMISSION_DATE,
    expectedDecisionDate: overrides.expectedDecisionDate ?? DECISION_DATE,
    attributes,
  };
}

function item(result: CheckResult, ruleId: string): ItemResult {
  const found = result.items.find((candidate) => candidate.ruleId === ruleId);
  assert.ok(found, `expected a result for rule ${ruleId}`);
  return found;
}

/** A payslip aged exactly `age` days at the expected decision date. */
function payslipAged(age: number, id = 'doc-ps-1'): DocumentMeta {
  return doc({
    id,
    documentType: 'payslips',
    issueDate: addDays(DECISION_DATE, -age),
  });
}

const PAYSLIP_RULE = rule({
  ruleId: 'PS-PSL-01',
  documentType: 'payslips',
  maxAgeDays: PAYSLIP_MAX_AGE,
});

/** TRD §8 `PS-EVL-01`; PRD E-13 uses this exact rule and attribute. */
const TENURE_CONDITION: Condition = { field: 'tenure_months', op: '<', value: 12 };

function evlRule(): RuleItem {
  return rule({
    ruleId: 'PS-EVL-01',
    documentType: 'employment_verification_letter',
    maxAgeDays: 60,
    condition: TENURE_CONDITION,
  });
}

const SHORT_TENURE: ApplicationAttributes = {
  employment_type: 'salaried',
  tenure_months: 6,
  loan_amount: 250_000,
};
const LONG_TENURE: ApplicationAttributes = { ...SHORT_TENURE, tenure_months: 24 };

function payslipStatus(age: number, horizon = WARNING_HORIZON_DAYS): ItemStatus {
  const result = evaluate({
    application: application(SHORT_TENURE),
    documents: [payslipAged(age)],
    rules: ruleSet([PAYSLIP_RULE], { warning_horizon_days: horizon }),
  });
  return item(result, 'PS-PSL-01').status;
}

// ===========================================================================
// Row: Missing required
// ===========================================================================

describe('§15.1 Missing required', () => {
  it('is MISSING, blocks readiness, and records no evaluated document', () => {
    const result = evaluate({
      application: application(SHORT_TENURE),
      documents: [],
      rules: ruleSet([
        rule({ ruleId: 'PS-BANK-01', documentType: 'bank_statement', maxAgeDays: 30 }),
      ]),
    });

    const evaluated = item(result, 'PS-BANK-01');
    assert.equal(evaluated.status, ItemStatus.MISSING);
    assert.equal(evaluated.reasonCode, ReasonCode.NO_DOCUMENT);
    assert.equal(evaluated.evaluatedDocumentId, null);
    assert.equal(evaluated.dateProvenance, null);
    assert.equal(evaluated.reasonText, 'No bank statement uploaded.');
    assert.equal(
      evaluated.nextAction,
      'Upload a bank statement issued within the last 30 days.',
    );
    assert.equal(result.blockingCount, 1);
    assert.equal(result.overallStatus, OverallStatus.INCOMPLETE);
  });

  it('names every configured basis in the guidance', () => {
    const result = evaluate({
      application: application(SHORT_TENURE),
      documents: [],
      rules: ruleSet([
        rule({
          ruleId: 'PS-ID-01',
          documentType: 'government_id',
          maxAgeDays: 180,
          hardExpiry: true,
        }),
      ]),
    });

    assert.equal(
      item(result, 'PS-ID-01').nextAction,
      `Upload a government photo ID issued within the last 180 days and with an expiry date on or after ${DECISION_DATE}.`,
    );
  });
});

// ===========================================================================
// Rows: Freshness pass / Warning boundary / Freshness boundary / Freshness fail
// M = 60, H = 7 ⇒ PRESENT_VALID below 53, EXPIRING_SOON on 53…60, EXPIRED above.
// ===========================================================================

describe('§15.1 Freshness pass — age = max_age − horizon − 1', () => {
  it('is PRESENT_VALID', () => {
    assert.equal(payslipStatus(PAYSLIP_MAX_AGE - WARNING_HORIZON_DAYS - 1), ItemStatus.PRESENT_VALID);
    assert.equal(payslipStatus(0), ItemStatus.PRESENT_VALID);
  });
});

describe('§15.1 Warning boundary — age = max_age − horizon', () => {
  it('is EXPIRING_SOON, not PRESENT_VALID', () => {
    const result = evaluate({
      application: application(SHORT_TENURE),
      documents: [payslipAged(PAYSLIP_MAX_AGE - WARNING_HORIZON_DAYS)],
      rules: ruleSet([PAYSLIP_RULE]),
    });

    const evaluated = item(result, 'PS-PSL-01');
    assert.equal(evaluated.status, ItemStatus.EXPIRING_SOON);
    assert.equal(evaluated.reasonCode, ReasonCode.EXPIRING_SOON_FRESHNESS);
    assert.equal(result.blockingCount, 0);
    assert.equal(result.warningCount, 1);
  });
});

describe('§15.1 Freshness boundary — age = max_age', () => {
  it('is EXPIRING_SOON, not EXPIRED (PRD §10.7)', () => {
    assert.equal(payslipStatus(PAYSLIP_MAX_AGE), ItemStatus.EXPIRING_SOON);
  });
});

describe('§15.1 Freshness fail — age = max_age + 1', () => {
  it('is EXPIRED and blocks', () => {
    const age = PAYSLIP_MAX_AGE + 1;
    const result = evaluate({
      application: application(SHORT_TENURE),
      documents: [payslipAged(age)],
      rules: ruleSet([PAYSLIP_RULE]),
    });

    const evaluated = item(result, 'PS-PSL-01');
    assert.equal(evaluated.status, ItemStatus.EXPIRED);
    assert.equal(evaluated.reasonCode, ReasonCode.FRESHNESS_AT_DECISION);
    assert.equal(result.blockingCount, 1);
    assert.equal(result.overallStatus, OverallStatus.INCOMPLETE);
    // PC-19: concrete numbers, not a generic message.
    assert.equal(
      evaluated.reasonText,
      `Will be ${age} days old on ${DECISION_DATE}; max allowed is ${PAYSLIP_MAX_AGE} days.`,
    );
    assert.equal(
      evaluated.nextAction,
      `Upload your payslips issued on or after ${addDays(DECISION_DATE, -PAYSLIP_MAX_AGE)}.`,
    );
  });
});

describe('added — the warned range is M − H … M inclusive (H + 1 days)', () => {
  it('holds at every age from 0 to M + 1', () => {
    for (let age = 0; age <= PAYSLIP_MAX_AGE + 1; age += 1) {
      const expected =
        age > PAYSLIP_MAX_AGE
          ? ItemStatus.EXPIRED
          : age >= PAYSLIP_MAX_AGE - WARNING_HORIZON_DAYS
            ? ItemStatus.EXPIRING_SOON
            : ItemStatus.PRESENT_VALID;
      assert.equal(payslipStatus(age), expected, `age ${age}`);
    }
  });

  it('warns only at age = max_age when the horizon is 0', () => {
    assert.equal(payslipStatus(PAYSLIP_MAX_AGE - 1, 0), ItemStatus.PRESENT_VALID);
    assert.equal(payslipStatus(PAYSLIP_MAX_AGE, 0), ItemStatus.EXPIRING_SOON);
    assert.equal(payslipStatus(PAYSLIP_MAX_AGE + 1, 0), ItemStatus.EXPIRED);
  });

  it('measures age at the decision date, not at submission', () => {
    // Issued 55 days before the decision date but only 50 days before
    // submission. Measuring at submission would pass it; the decision-date
    // forecast (BRD §4.2) expires it inside the warning window.
    const issueDate = addDays(DECISION_DATE, -55);
    assert.equal(daysBetween(SUBMISSION_DATE, issueDate) * -1, 50);
    assert.equal(payslipStatus(55), ItemStatus.EXPIRING_SOON);
    const result = evaluate({
      application: application(SHORT_TENURE),
      documents: [doc({ id: 'doc-ps-1', documentType: 'payslips', issueDate })],
      rules: ruleSet([PAYSLIP_RULE]),
    });
    assert.equal(item(result, 'PS-PSL-01').status, ItemStatus.EXPIRING_SOON);
  });
});

// ===========================================================================
// Rows: Hard expiry fail / Hard expiry boundary
// ===========================================================================

const ID_RULE = rule({ ruleId: 'PS-ID-01', documentType: 'government_id', hardExpiry: true });

describe('§15.1 Hard expiry fail — expiry_date = decision − 1', () => {
  it('is EXPIRED and blocks', () => {
    const expiryDate = addDays(DECISION_DATE, -1);
    const result = evaluate({
      application: application(SHORT_TENURE),
      documents: [doc({ id: 'doc-id-1', documentType: 'government_id', expiryDate })],
      rules: ruleSet([ID_RULE]),
    });

    const evaluated = item(result, 'PS-ID-01');
    assert.equal(evaluated.status, ItemStatus.EXPIRED);
    assert.equal(evaluated.reasonCode, ReasonCode.HARD_EXPIRY_PASSED);
    assert.equal(result.blockingCount, 1);
    assert.match(evaluated.reasonText, new RegExp(expiryDate));
  });
});

describe('§15.1 Hard expiry boundary — expiry_date = decision', () => {
  it('is EXPIRING_SOON: valid that day, with no margin', () => {
    const result = evaluate({
      application: application(SHORT_TENURE),
      documents: [
        doc({ id: 'doc-id-1', documentType: 'government_id', expiryDate: DECISION_DATE }),
      ],
      rules: ruleSet([ID_RULE]),
    });

    const evaluated = item(result, 'PS-ID-01');
    assert.equal(evaluated.status, ItemStatus.EXPIRING_SOON);
    assert.equal(evaluated.reasonCode, ReasonCode.EXPIRING_SOON_HARD_EXPIRY);
    assert.equal(result.blockingCount, 0);
    assert.equal(result.warningCount, 1);
    assert.equal(result.overallStatus, OverallStatus.COMPLETE_WITH_WARNINGS);
  });

  it('is PRESENT_VALID one day later, and ignores the freshness horizon', () => {
    // The hard-expiry basis warns on equality only; it is not horizon-scaled.
    const result = evaluate({
      application: application(SHORT_TENURE),
      documents: [
        doc({
          id: 'doc-id-1',
          documentType: 'government_id',
          expiryDate: addDays(DECISION_DATE, 1),
        }),
      ],
      rules: ruleSet([ID_RULE], { warning_horizon_days: 30 }),
    });

    assert.equal(item(result, 'PS-ID-01').status, ItemStatus.PRESENT_VALID);
    assert.equal(result.warningCount, 0);
  });
});

// ===========================================================================
// Rows: Conditional off / Conditional attribute absent
// ===========================================================================

describe('§15.1 Conditional off — tenure_months = 24 on the EVL rule', () => {
  it('is NOT_APPLICABLE and excluded from the score', () => {
    const result = evaluate({
      application: application(LONG_TENURE),
      documents: [],
      rules: ruleSet([evlRule()]),
    });

    const evaluated = item(result, 'PS-EVL-01');
    assert.equal(evaluated.status, ItemStatus.NOT_APPLICABLE);
    assert.equal(evaluated.reasonCode, ReasonCode.CONDITION_NOT_MET);
    assert.equal(evaluated.evaluatedDocumentId, null);
    assert.equal(result.applicableRequiredCount, 0);
    assert.equal(result.countsByStatus.NOT_APPLICABLE, 1);
    assert.equal(result.score, 100);
    assert.equal(result.overallStatus, OverallStatus.DECISION_READY);
  });

  it('is evaluated normally when the condition holds', () => {
    const result = evaluate({
      application: application(SHORT_TENURE),
      documents: [
        doc({
          id: 'doc-evl-1',
          documentType: 'employment_verification_letter',
          issueDate: addDays(DECISION_DATE, -10),
        }),
      ],
      rules: ruleSet([evlRule()]),
    });

    assert.equal(item(result, 'PS-EVL-01').status, ItemStatus.PRESENT_VALID);
    assert.equal(item(result, 'PS-EVL-01').evaluatedDocumentId, 'doc-evl-1');
    assert.equal(result.applicableRequiredCount, 1);
  });

  it('blocks when the condition holds and the document is absent', () => {
    const result = evaluate({
      application: application(SHORT_TENURE),
      documents: [],
      rules: ruleSet([evlRule()]),
    });

    assert.equal(item(result, 'PS-EVL-01').status, ItemStatus.MISSING);
    assert.equal(result.blockingCount, 1);
  });
});

describe('§15.1 Conditional attribute absent — tenure_months not in attributes', () => {
  it('is NOT_APPLICABLE with the E-13 reason naming the missing attribute', () => {
    const result = evaluate({
      application: application({ employment_type: 'salaried', loan_amount: 250_000 }),
      documents: [],
      rules: ruleSet([evlRule()]),
    });

    const evaluated = item(result, 'PS-EVL-01');
    assert.equal(evaluated.status, ItemStatus.NOT_APPLICABLE);
    // Not CONDITION_NOT_MET: an unset attribute is a data gap. Treating it as
    // "condition false" would silently hide a document (PRD E-13).
    assert.equal(evaluated.reasonCode, ReasonCode.CONDITION_ATTRIBUTE_MISSING);
    assert.equal(
      evaluated.reasonText,
      "Rule PS-EVL-01 not evaluated: application attribute 'tenure_months' is not set.",
    );
    assert.equal(result.blockingCount, 0);
    assert.equal(result.applicableRequiredCount, 0);
  });
});

// ===========================================================================
// Rows: Version supersede / Version tie-break / Full document tie
// ===========================================================================

describe('§15.1 Version supersede — newer issue_date doc invalid, older valid', () => {
  it('is EXPIRED: the latest document governs even when that makes it fail', () => {
    // Only reachable on a hard-expiry basis. Under freshness, a newer issue date
    // is by definition the fresher document, so "newer but invalid" cannot
    // happen — see the complementary case below. A renewed ID whose expiry has
    // already passed is the real-world shape: it supersedes an older, still-valid
    // one, and the engine must not fall back to the superseded document.
    const superseded = doc({
      id: 'doc-old',
      documentType: 'government_id',
      issueDate: addDays(DECISION_DATE, -400),
      expiryDate: addDays(DECISION_DATE, 400), // would be PRESENT_VALID
    });
    const governing = doc({
      id: 'doc-new',
      documentType: 'government_id',
      issueDate: addDays(DECISION_DATE, -10), // most recent ⇒ governs
      expiryDate: addDays(DECISION_DATE, -1), // …and has already expired
    });

    const result = evaluate({
      application: application(SHORT_TENURE),
      documents: [superseded, governing],
      rules: ruleSet([ID_RULE]),
    });

    const evaluated = item(result, 'PS-ID-01');
    assert.equal(evaluated.evaluatedDocumentId, 'doc-new');
    assert.equal(evaluated.status, ItemStatus.EXPIRED);
    assert.equal(evaluated.reasonCode, ReasonCode.HARD_EXPIRY_PASSED);
    assert.equal(result.blockingCount, 1);
    assert.equal(result.overallStatus, OverallStatus.INCOMPLETE);
  });

  it('supersedes a stale document with a fresher one under a freshness basis', () => {
    const result = evaluate({
      application: application(SHORT_TENURE),
      documents: [
        doc({
          id: 'doc-old',
          documentType: 'payslips',
          issueDate: addDays(DECISION_DATE, -(PAYSLIP_MAX_AGE + 10)), // stale
        }),
        doc({
          id: 'doc-new',
          documentType: 'payslips',
          issueDate: addDays(DECISION_DATE, -50), // within max_age
        }),
      ],
      rules: ruleSet([PAYSLIP_RULE]),
    });

    assert.equal(item(result, 'PS-PSL-01').evaluatedDocumentId, 'doc-new');
    assert.equal(item(result, 'PS-PSL-01').status, ItemStatus.PRESENT_VALID);
    assert.equal(result.blockingCount, 0);
  });

  it('picks the most recent issue date regardless of upload order', () => {
    const newer = addDays(DECISION_DATE, -5);
    const older = addDays(DECISION_DATE, -80);
    const documents = [
      doc({ id: 'doc-new', documentType: 'payslips', issueDate: newer }),
      doc({ id: 'doc-old', documentType: 'payslips', issueDate: older }),
    ];

    for (const ordered of [documents, [...documents].reverse()]) {
      const result = evaluate({
        application: application(SHORT_TENURE),
        documents: ordered,
        rules: ruleSet([PAYSLIP_RULE]),
      });
      assert.equal(item(result, 'PS-PSL-01').evaluatedDocumentId, 'doc-new');
    }
  });
});

describe('§15.1 Version tie-break — same issue_date, different uploaded_at', () => {
  const issueDate = addDays(DECISION_DATE, -30);

  it('evaluates the later upload', () => {
    const result = evaluate({
      application: application(SHORT_TENURE),
      documents: [
        doc({
          id: 'doc-late',
          documentType: 'payslips',
          issueDate,
          uploadedAt: '2026-01-05T16:30:00.000Z',
        }),
        doc({
          id: 'doc-early',
          documentType: 'payslips',
          issueDate,
          uploadedAt: '2026-01-05T08:00:00.000Z',
        }),
      ],
      rules: ruleSet([PAYSLIP_RULE]),
    });

    assert.equal(item(result, 'PS-PSL-01').evaluatedDocumentId, 'doc-late');
  });

  it('breaks a further tie on the higher version', () => {
    const uploadedAt = '2026-01-05T09:00:00.000Z';
    const result = evaluate({
      application: application(SHORT_TENURE),
      documents: [
        doc({ id: 'doc-v1', documentType: 'payslips', issueDate, uploadedAt, version: 1 }),
        doc({ id: 'doc-v2', documentType: 'payslips', issueDate, uploadedAt, version: 2 }),
      ],
      rules: ruleSet([PAYSLIP_RULE]),
    });

    assert.equal(item(result, 'PS-PSL-01').evaluatedDocumentId, 'doc-v2');
  });
});

describe('added — full document tie: same issue_date, uploaded_at and version', () => {
  it('evaluates the greatest id, making selection a total order', () => {
    const issueDate = addDays(DECISION_DATE, -30);
    const result = evaluate({
      application: application(SHORT_TENURE),
      documents: [
        doc({ id: 'doc-b', documentType: 'payslips', issueDate }),
        doc({ id: 'doc-a', documentType: 'payslips', issueDate }),
      ],
      rules: ruleSet([PAYSLIP_RULE]),
    });

    assert.equal(item(result, 'PS-PSL-01').evaluatedDocumentId, 'doc-b');
  });

  it('treats a null issue date as older than any real date', () => {
    const result = evaluate({
      application: application(SHORT_TENURE),
      documents: [
        doc({ id: 'doc-undated', documentType: 'payslips', issueDate: null }),
        doc({ id: 'doc-dated', documentType: 'payslips', issueDate: addDays(DECISION_DATE, -30) }),
      ],
      rules: ruleSet([PAYSLIP_RULE]),
    });

    assert.equal(item(result, 'PS-PSL-01').evaluatedDocumentId, 'doc-dated');
  });
});

// ===========================================================================
// Row: Score with warning
// ===========================================================================

const FIVE_REQUIRED_RULES: readonly RuleItem[] = [
  rule({ ruleId: 'PS-ID-01', documentType: 'government_id', hardExpiry: true }),
  rule({ ruleId: 'PS-ADR-01', documentType: 'address_proof', maxAgeDays: 180 }),
  rule({ ruleId: 'PS-PSL-01', documentType: 'payslips', maxAgeDays: PAYSLIP_MAX_AGE }),
  rule({ ruleId: 'PS-BANK-01', documentType: 'bank_statement', maxAgeDays: 30 }),
  rule({ ruleId: 'PS-CBR-01', documentType: 'credit_bureau_report', maxAgeDays: 90 }),
];

function fiveRequiredDocuments(payslipAge: number): DocumentMeta[] {
  return [
    doc({
      id: 'doc-id-1',
      documentType: 'government_id',
      expiryDate: addDays(DECISION_DATE, 400),
    }),
    doc({
      id: 'doc-adr-1',
      documentType: 'address_proof',
      issueDate: addDays(DECISION_DATE, -20),
    }),
    doc({
      id: 'doc-ps-1',
      documentType: 'payslips',
      issueDate: addDays(DECISION_DATE, -payslipAge),
    }),
    doc({
      id: 'doc-bank-1',
      documentType: 'bank_statement',
      issueDate: addDays(DECISION_DATE, -5),
    }),
    doc({
      id: 'doc-cbr-1',
      documentType: 'credit_bureau_report',
      issueDate: addDays(DECISION_DATE, -5),
    }),
  ];
}

describe('§15.1 Score with warning — 4 valid + 1 expiring of 5 required', () => {
  it('scores 100 and is COMPLETE_WITH_WARNINGS', () => {
    const result = evaluate({
      application: application(SHORT_TENURE),
      documents: fiveRequiredDocuments(PAYSLIP_MAX_AGE - WARNING_HORIZON_DAYS),
      rules: ruleSet(FIVE_REQUIRED_RULES),
    });

    assert.equal(result.applicableRequiredCount, 5);
    assert.equal(result.validRequiredCount, 5);
    assert.equal(result.score, 100);
    assert.equal(result.warningCount, 1);
    assert.equal(result.blockingCount, 0);
    assert.equal(result.overallStatus, OverallStatus.COMPLETE_WITH_WARNINGS);
  });

  it('becomes DECISION_READY once the warning is acknowledged, with no item changed', () => {
    const documents = fiveRequiredDocuments(PAYSLIP_MAX_AGE - WARNING_HORIZON_DAYS);
    const rules = ruleSet(FIVE_REQUIRED_RULES);

    const before = evaluate({
      application: application(SHORT_TENURE),
      documents,
      rules,
      warningsAcknowledged: false,
    });
    const after = evaluate({
      application: application(SHORT_TENURE),
      documents,
      rules,
      warningsAcknowledged: true,
    });

    assert.equal(before.overallStatus, OverallStatus.COMPLETE_WITH_WARNINGS);
    assert.equal(after.overallStatus, OverallStatus.DECISION_READY);
    // TRD §7.4 — acknowledgment is an overlay; it never mutates item results.
    assert.deepEqual(after.items, before.items);
    assert.equal(after.warningCount, before.warningCount);
    assert.equal(after.score, before.score);
  });
});

// ===========================================================================
// Rows: Empty application / Decision date in the past
// ===========================================================================

describe('§15.1 Empty application — zero documents uploaded', () => {
  it('marks every required item MISSING with score 0 and no error (E-12)', () => {
    const result = evaluate({
      application: application(SHORT_TENURE),
      documents: [],
      rules: ruleSet(FIVE_REQUIRED_RULES),
    });

    assert.equal(result.items.length, 5);
    assert.equal(result.countsByStatus.MISSING, 5);
    assert.equal(result.score, 0);
    assert.equal(result.blockingCount, 5);
    assert.equal(result.overallStatus, OverallStatus.INCOMPLETE);
    for (const evaluated of result.items) {
      assert.equal(evaluated.status, ItemStatus.MISSING);
      assert.equal(evaluated.reasonCode, ReasonCode.NO_DOCUMENT);
    }
  });

  it('scores 100 when no rule is applicable', () => {
    const result = evaluate({
      application: application(LONG_TENURE),
      documents: [],
      rules: ruleSet([evlRule()]),
    });

    assert.equal(result.applicableRequiredCount, 0);
    assert.equal(result.score, 100);
  });

  it('tolerates an application with no attributes at all', () => {
    const result = evaluate({
      application: application({}),
      documents: [],
      rules: ruleSet(FIVE_REQUIRED_RULES),
    });

    assert.equal(result.countsByStatus.MISSING, 5);
    assert.equal(Number.isInteger(result.score), true);
  });
});

describe('§15.1 Decision date in the past — expected_decision_date < today', () => {
  // PRD E-18 example date. Submission is deliberately after it: an inconsistent
  // SLA is exactly how this state arises.
  const pastDecisionDate: ISODate = '2025-11-02';

  it('runs normally and expires stale freshness items', () => {
    const result = evaluate({
      application: application(SHORT_TENURE, { expectedDecisionDate: pastDecisionDate }),
      documents: [
        doc({
          id: 'doc-ps-1',
          documentType: 'payslips',
          issueDate: '2025-09-01', // 62 days before the past decision date
        }),
      ],
      rules: ruleSet([PAYSLIP_RULE]),
    });

    const evaluated = item(result, 'PS-PSL-01');
    assert.equal(daysBetween('2025-09-01', pastDecisionDate), 62);
    assert.equal(evaluated.status, ItemStatus.EXPIRED);
    assert.equal(result.overallStatus, OverallStatus.INCOMPLETE);
    assert.equal(Number.isInteger(result.score), true);
  });

  it('reports ages against the decision date it was given, not against today', () => {
    const result = evaluate({
      application: application(SHORT_TENURE, { expectedDecisionDate: pastDecisionDate }),
      documents: [doc({ id: 'doc-ps-1', documentType: 'payslips', issueDate: '2025-10-20' })],
      rules: ruleSet([PAYSLIP_RULE]),
    });

    // 13 days old at the past decision date — still fresh there.
    assert.equal(item(result, 'PS-PSL-01').status, ItemStatus.PRESENT_VALID);
  });

  it('still fails a document that expired before the past decision date', () => {
    const result = evaluate({
      application: application(SHORT_TENURE, { expectedDecisionDate: pastDecisionDate }),
      documents: [
        doc({ id: 'doc-id-1', documentType: 'government_id', expiryDate: '2025-10-01' }),
      ],
      rules: ruleSet([ID_RULE]),
    });

    assert.equal(item(result, 'PS-ID-01').status, ItemStatus.EXPIRED);
  });

  it('does not invent a status for a document issued after the decision date', () => {
    // A negative age is not a validity claim the engine may make. It stays
    // PRESENT_VALID; the inconsistency is E-18's banner, rendered by the client.
    const result = evaluate({
      application: application(SHORT_TENURE, { expectedDecisionDate: pastDecisionDate }),
      documents: [doc({ id: 'doc-ps-1', documentType: 'payslips', issueDate: '2025-12-01' })],
      rules: ruleSet([PAYSLIP_RULE]),
    });

    assert.equal(item(result, 'PS-PSL-01').status, ItemStatus.PRESENT_VALID);
    assert.equal(result.blockingCount, 0);
  });
});

// ===========================================================================
// Row: Unknown rule combination (and the rest of the schema gate)
// ===========================================================================

describe('§15.1 Unknown rule combination — neither freshness nor hard_expiry', () => {
  it('is rejected by zod at save time and never reaches the engine (PC-25)', () => {
    const parsed = RuleItemSchema.safeParse({
      rule_id: 'PS-PSL-01',
      document_type: 'payslips',
      requirement: 'required',
      condition: null,
      freshness: null,
      hard_expiry: false,
    });

    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.match(
        parsed.error.issues.map((issue) => issue.message).join(' | '),
        /at least one of freshness or hard_expiry/,
      );
    }
  });
});

describe('added — the rest of the rule-set gate', () => {
  const baseItem = {
    rule_id: 'PS-PSL-01',
    document_type: 'payslips',
    requirement: 'required',
    condition: null,
    freshness: { kind: 'max_age', max_age_days: PAYSLIP_MAX_AGE },
    hard_expiry: false,
  };

  it('rejects a conditional rule with no condition', () => {
    const parsed = RuleItemSchema.safeParse({
      ...baseItem,
      requirement: 'conditional',
      condition: null,
    });
    assert.equal(parsed.success, false);
  });

  it('rejects a condition on a rule that is not conditional', () => {
    const parsed = RuleItemSchema.safeParse({ ...baseItem, condition: TENURE_CONDITION });
    assert.equal(parsed.success, false);
  });

  it('accepts the conditional form of the same rule', () => {
    const parsed = RuleItemSchema.safeParse({
      ...baseItem,
      requirement: 'conditional',
      condition: TENURE_CONDITION,
    });
    assert.equal(parsed.success, true);
  });

  it('accepts a rule with both bases', () => {
    const parsed = RuleItemSchema.safeParse({ ...baseItem, hard_expiry: true });
    assert.equal(parsed.success, true);
  });

  it('rejects duplicate rule ids in one set', () => {
    const parsed = RuleSetSchema.safeParse({
      product_id: PRODUCT_ID,
      version: RULE_VERSION,
      warning_horizon_days: WARNING_HORIZON_DAYS,
      items: [baseItem, baseItem],
    });
    assert.equal(parsed.success, false);
  });

  it('rejects an empty rule set', () => {
    const parsed = RuleSetSchema.safeParse({
      product_id: PRODUCT_ID,
      version: RULE_VERSION,
      warning_horizon_days: WARNING_HORIZON_DAYS,
      items: [],
    });
    assert.equal(parsed.success, false);
  });

  it('rejects a malformed rule id', () => {
    const parsed = RuleItemSchema.safeParse({ ...baseItem, rule_id: 'ps-psl-1' });
    assert.equal(parsed.success, false);
  });

  it('rejects an unknown document type', () => {
    const parsed = RuleItemSchema.safeParse({ ...baseItem, document_type: 'borrower_selfie' });
    assert.equal(parsed.success, false);
  });

  it('rejects a negative freshness window and a negative horizon', () => {
    assert.equal(
      RuleItemSchema.safeParse({
        ...baseItem,
        freshness: { kind: 'max_age', max_age_days: -1 },
      }).success,
      false,
    );
    assert.equal(
      RuleSetSchema.safeParse({
        product_id: PRODUCT_ID,
        version: RULE_VERSION,
        warning_horizon_days: -1,
        items: [baseItem],
      }).success,
      false,
    );
  });

  it('accepts the salaried rule set used throughout this suite', () => {
    assert.equal(RuleSetSchema.safeParse(ruleSet(FIVE_REQUIRED_RULES)).success, true);
  });
});

// ===========================================================================
// Row: Determinism
// ===========================================================================

describe('§15.1 Determinism — same input twice', () => {
  const documents = fiveRequiredDocuments(PAYSLIP_MAX_AGE - WARNING_HORIZON_DAYS);
  const rules = ruleSet([...FIVE_REQUIRED_RULES, evlRule()]);
  const input = { application: application(SHORT_TENURE), documents, rules };

  it('produces byte-identical output including ordering', () => {
    const first = JSON.stringify(evaluate(input));
    for (let run = 0; run < 25; run += 1) {
      assert.equal(JSON.stringify(evaluate(input)), first);
    }
  });

  it('does not mutate its input', () => {
    const snapshot = JSON.stringify(input);
    evaluate(input);
    assert.equal(JSON.stringify(input), snapshot);
  });

  it('stamps every evaluated item with the fixed date-provenance string', () => {
    for (const evaluated of evaluate(input).items) {
      const expected =
        evaluated.evaluatedDocumentId === null ? null : DATE_PROVENANCE_OFFICER_ENTRY;
      assert.equal(evaluated.dateProvenance, expected, evaluated.ruleId);
    }
  });
});

describe('added — determinism under input reordering', () => {
  const documents = fiveRequiredDocuments(30);

  it('sorts items by rule_id, not by configuration order', () => {
    const orders: readonly (readonly RuleItem[])[] = [
      FIVE_REQUIRED_RULES,
      [...FIVE_REQUIRED_RULES].reverse(),
      [
        FIVE_REQUIRED_RULES[2]!,
        FIVE_REQUIRED_RULES[4]!,
        FIVE_REQUIRED_RULES[0]!,
        FIVE_REQUIRED_RULES[3]!,
        FIVE_REQUIRED_RULES[1]!,
      ],
    ];
    const serialized = orders.map((ordered) =>
      JSON.stringify(
        evaluate({
          application: application(SHORT_TENURE),
          documents,
          rules: ruleSet(ordered),
        }),
      ),
    );

    assert.equal(serialized[1], serialized[0]);
    assert.equal(serialized[2], serialized[0]);
    assert.deepEqual(
      JSON.parse(serialized[0]!).items.map((entry: { ruleId: string }) => entry.ruleId),
      ['PS-ADR-01', 'PS-BANK-01', 'PS-CBR-01', 'PS-ID-01', 'PS-PSL-01'],
    );
  });

  it('is independent of document upload order', () => {
    const rules = ruleSet(FIVE_REQUIRED_RULES);
    const forward = JSON.stringify(
      evaluate({ application: application(SHORT_TENURE), documents, rules }),
    );
    const backward = JSON.stringify(
      evaluate({
        application: application(SHORT_TENURE),
        documents: [...documents].reverse(),
        rules,
      }),
    );

    assert.equal(backward, forward);
  });
});

// ===========================================================================
// Added: severity when both bases are configured
// ===========================================================================

describe('added — both bases configured on one rule', () => {
  const bothBases = rule({
    ruleId: 'PS-ID-02',
    documentType: 'government_id',
    maxAgeDays: 180,
    hardExpiry: true,
  });

  it('lets the most severe basis win: fresh issue date, passed expiry', () => {
    const result = evaluate({
      application: application(SHORT_TENURE),
      documents: [
        doc({
          id: 'doc-id-1',
          documentType: 'government_id',
          issueDate: addDays(DECISION_DATE, -10),
          expiryDate: addDays(DECISION_DATE, -1),
        }),
      ],
      rules: ruleSet([bothBases]),
    });

    const evaluated = item(result, 'PS-ID-02');
    assert.equal(evaluated.status, ItemStatus.EXPIRED);
    assert.equal(evaluated.reasonCode, ReasonCode.HARD_EXPIRY_PASSED);
  });

  it('fails closed when the governing date is null', () => {
    const noIssueDate = evaluate({
      application: application(SHORT_TENURE),
      documents: [
        doc({
          id: 'doc-id-1',
          documentType: 'government_id',
          issueDate: null,
          expiryDate: addDays(DECISION_DATE, 400),
        }),
      ],
      rules: ruleSet([bothBases]),
    });
    assert.equal(item(noIssueDate, 'PS-ID-02').status, ItemStatus.EXPIRED);
    assert.equal(item(noIssueDate, 'PS-ID-02').reasonCode, ReasonCode.ISSUE_DATE_ABSENT);

    const noExpiryDate = evaluate({
      application: application(SHORT_TENURE),
      documents: [
        doc({
          id: 'doc-id-1',
          documentType: 'government_id',
          issueDate: addDays(DECISION_DATE, -10),
          expiryDate: null,
        }),
      ],
      rules: ruleSet([ID_RULE]),
    });
    // BRD BR-01: unverifiable is reported as a failure, never as a pass.
    assert.equal(item(noExpiryDate, 'PS-ID-01').status, ItemStatus.EXPIRED);
    assert.equal(item(noExpiryDate, 'PS-ID-01').reasonCode, ReasonCode.EXPIRY_DATE_ABSENT);
    assert.equal(item(noExpiryDate, 'PS-ID-01').evaluatedDocumentId, 'doc-id-1');
  });
});

describe('added — optional requirement level', () => {
  const optionalRule = rule({
    ruleId: 'PS-INS-01',
    documentType: 'insurance_certificate',
    requirement: 'optional',
    hardExpiry: true,
  });

  it('is NOT_APPLICABLE when absent, not MISSING', () => {
    const result = evaluate({
      application: application(SHORT_TENURE),
      documents: [],
      rules: ruleSet([optionalRule]),
    });

    const evaluated = item(result, 'PS-INS-01');
    // PRD §7.1 defines Missing as a *required* document with no file; §10.5
    // excludes optional items from the score either way.
    assert.equal(evaluated.status, ItemStatus.NOT_APPLICABLE);
    assert.equal(evaluated.reasonCode, ReasonCode.OPTIONAL_NOT_REQUIRED);
    assert.equal(result.blockingCount, 0);
    assert.equal(result.applicableRequiredCount, 0);
    assert.equal(result.score, 100);
    assert.equal(result.overallStatus, OverallStatus.DECISION_READY);
  });

  it('is still evaluated when uploaded, but never gates', () => {
    const result = evaluate({
      application: application(SHORT_TENURE),
      documents: [
        doc({
          id: 'doc-ins-1',
          documentType: 'insurance_certificate',
          expiryDate: addDays(DECISION_DATE, -1),
        }),
      ],
      rules: ruleSet([optionalRule]),
    });

    assert.equal(item(result, 'PS-INS-01').status, ItemStatus.EXPIRED);
    assert.equal(result.blockingCount, 0);
    assert.equal(result.applicableRequiredCount, 0);
    assert.equal(result.score, 100);
  });

  it('counts an expiring optional item as a warning (PRD §10.6)', () => {
    const result = evaluate({
      application: application(SHORT_TENURE),
      documents: [
        doc({
          id: 'doc-ins-1',
          documentType: 'insurance_certificate',
          expiryDate: DECISION_DATE,
        }),
      ],
      rules: ruleSet([optionalRule]),
    });

    assert.equal(result.warningCount, 1);
    assert.equal(result.applicableRequiredCount, 0);
    assert.equal(result.overallStatus, OverallStatus.COMPLETE_WITH_WARNINGS);
  });

  it('never appears in a blocking count alongside required items', () => {
    const result = evaluate({
      application: application(SHORT_TENURE),
      documents: fiveRequiredDocuments(10),
      rules: ruleSet([...FIVE_REQUIRED_RULES, optionalRule]),
    });

    assert.equal(result.applicableRequiredCount, 5);
    assert.equal(result.blockingCount, 0);
    assert.equal(result.score, 100);
  });
});

// ===========================================================================
// Score arithmetic — PRD §10.5
// ===========================================================================

describe('PRD §10.5 — score arithmetic', () => {
  it('is valid applicable-required over applicable-required, rounded', () => {
    const documents = fiveRequiredDocuments(10).slice(0, 3);
    const result = evaluate({
      application: application(SHORT_TENURE),
      documents,
      rules: ruleSet(FIVE_REQUIRED_RULES),
    });

    assert.equal(result.applicableRequiredCount, 5);
    assert.equal(result.validRequiredCount, 3);
    assert.equal(result.score, 60);
  });

  it('rounds to the nearest integer', () => {
    const threeRules = FIVE_REQUIRED_RULES.slice(0, 3);
    const result = evaluate({
      application: application(SHORT_TENURE),
      documents: fiveRequiredDocuments(10).slice(0, 2),
      rules: ruleSet(threeRules),
    });

    // 2 of 3 = 66.67 → 67
    assert.equal(result.score, 67);
  });

  it('excludes NOT_APPLICABLE items from the denominator', () => {
    const result = evaluate({
      application: application(LONG_TENURE), // tenure 24 ⇒ EVL not applicable
      documents: fiveRequiredDocuments(10),
      rules: ruleSet([...FIVE_REQUIRED_RULES, evlRule()]),
    });

    assert.equal(result.applicableRequiredCount, 5);
    assert.equal(result.countsByStatus.NOT_APPLICABLE, 1);
    assert.equal(result.score, 100);
  });
});

describe('PRD §10.6 — overall status precedence', () => {
  it('lets a blocker outrank an acknowledgment', () => {
    assert.equal(
      resolveOverallStatus({
        blockingCount: 1,
        warningCount: 1,
        warningsAcknowledged: true,
      }),
      OverallStatus.INCOMPLETE,
    );
  });

  it('covers all four combinations', () => {
    assert.equal(
      resolveOverallStatus({ blockingCount: 0, warningCount: 0, warningsAcknowledged: false }),
      OverallStatus.DECISION_READY,
    );
    assert.equal(
      resolveOverallStatus({ blockingCount: 0, warningCount: 1, warningsAcknowledged: false }),
      OverallStatus.COMPLETE_WITH_WARNINGS,
    );
    assert.equal(
      resolveOverallStatus({ blockingCount: 0, warningCount: 1, warningsAcknowledged: true }),
      OverallStatus.DECISION_READY,
    );
    assert.equal(
      resolveOverallStatus({ blockingCount: 2, warningCount: 0, warningsAcknowledged: false }),
      OverallStatus.INCOMPLETE,
    );
  });
});

// ===========================================================================
// Date arithmetic — the shared util the whole engine depends on
// ===========================================================================

describe('UTC integer-day date arithmetic', () => {
  it('rolls 31 Jan forward through a 28-day February', () => {
    assert.equal(addDays('2026-01-31', 30), '2026-03-02');
  });

  it('rolls 31 Jan forward through a 29-day February', () => {
    assert.equal(addDays('2028-01-31', 30), '2028-03-01');
  });

  it('crosses a year boundary in both directions', () => {
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(addDays('2027-01-01', -1), '2026-12-31');
    assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1);
  });

  it('is unaffected by a DST transition in either hemisphere', () => {
    // US DST 2026 begins 08 Mar; a naive local-time implementation loses a day.
    assert.equal(daysBetween('2026-03-07', '2026-03-11'), 4);
    assert.equal(addDays('2026-03-07', 4), '2026-03-11');
    // Australia ends DST on the first Sunday of April.
    assert.equal(daysBetween('2026-04-03', '2026-04-07'), 4);
  });

  it('round-trips across the payslip freshness window', () => {
    const issueDate = addDays(DECISION_DATE, -PAYSLIP_MAX_AGE);
    assert.equal(daysBetween(issueDate, DECISION_DATE), PAYSLIP_MAX_AGE);
  });

  it('is antisymmetric', () => {
    assert.equal(daysBetween('2026-01-10', '2026-01-05'), -5);
    assert.equal(daysBetween('2026-01-05', '2026-01-05'), 0);
  });
});
