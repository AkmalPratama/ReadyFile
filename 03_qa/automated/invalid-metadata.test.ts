import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ItemStatus, OverallStatus, ReasonCode, addDays } from '../../02_source/packages/core/src/index.ts';
import { evaluate } from '../../02_source/packages/rules-engine/src/index.ts';
import type { CheckResult, DocumentMeta } from '../../02_source/packages/rules-engine/src/index.ts';
import {
  DEMO_DECISION_DATE,
  DEMO_SUBMISSION_DATE,
  demoApplication,
  demoDocument,
  salariedRuleSet,
} from './fixtures.ts';

/**
 * Invalid and contradictory document metadata — PRD §8.6 exceptions E-05 to E-08.
 *
 * PRD assigns all four of these to **"Client + server"** detection, i.e. upload
 * validation. None of that validation is built. The engine is nonetheless the
 * layer that turns bad metadata into a borrower-facing sentence and a gate
 * decision, so this suite pins what it does today.
 *
 * Two of the behaviours below are **defects**, reproduced deliberately rather
 * than fixed, because fixing them is a spec decision:
 *
 * - **DEF-07** — a document dated *after* the expected decision date evaluates to
 *   `PRESENT_VALID` and can carry a file to `DECISION_READY`. The gate is
 *   bypassed by the exact input E-07 exists to reject.
 * - **DEF-08** — the two "required date absent" reason strings begin with a
 *   lowercase word, unlike every other borrower-facing template.
 */

const DECISION = DEMO_DECISION_DATE; // 2026-03-07

function bankResult(documents: DocumentMeta[]): CheckResult {
  return evaluate({
    application: demoApplication(),
    documents,
    rules: salariedRuleSet(),
  });
}

function itemOf(result: CheckResult, ruleId: string) {
  const item = result.items.find((entry) => entry.ruleId === ruleId);
  assert.ok(item, `${ruleId} must be evaluated`);
  return item;
}

/** Every Salaried document except the bank statement, all comfortably valid. */
function otherValidDocuments(): DocumentMeta[] {
  return [
    demoDocument({ id: 'doc-id', documentType: 'government_id', expiryDate: '2030-01-01' }),
    demoDocument({ id: 'doc-adr', documentType: 'address_proof', issueDate: addDays(DECISION, -10) }),
    demoDocument({ id: 'doc-psl', documentType: 'payslips', issueDate: addDays(DECISION, -5) }),
    demoDocument({ id: 'doc-cbr', documentType: 'credit_bureau_report', issueDate: addDays(DECISION, -2) }),
  ];
}

describe('E-05 — issue date absent on a freshness-based type', () => {
  const result = bankResult([
    demoDocument({ id: 'doc-bank', documentType: 'bank_statement', issueDate: null }),
  ]);
  const bank = itemOf(result, 'PS-BANK-01');

  it('fails closed: EXPIRED, never PRESENT_VALID', () => {
    // BRD BR-01 — presence alone is insufficient. An unverifiable document must
    // not count as valid just because a file exists.
    assert.equal(bank.status, ItemStatus.EXPIRED);
    assert.equal(bank.reasonCode, ReasonCode.ISSUE_DATE_ABSENT);
    assert.equal(result.blockingCount >= 1, true);
    assert.equal(result.overallStatus, OverallStatus.INCOMPLETE);
  });

  it('explains that the file exists but cannot be verified', () => {
    assert.equal(
      bank.reasonText,
      'bank statement was uploaded but no issue date was recorded, so validity cannot be verified.',
    );
    assert.equal(
      bank.nextAction,
      'Re-upload a bank statement with its issue date recorded.',
    );
  });

  it('still carries the provenance marker — a date was expected and is absent', () => {
    assert.equal(bank.dateProvenance, 'document dates entered by officer at upload');
    assert.equal(bank.evaluatedDocumentId, 'doc-bank');
  });
});

describe('E-06 — expiry date absent on a hard-expiry type', () => {
  const result = bankResult([
    demoDocument({ id: 'doc-id', documentType: 'government_id', expiryDate: null }),
  ]);
  const id = itemOf(result, 'PS-ID-01');

  it('fails closed: EXPIRED with EXPIRY_DATE_ABSENT', () => {
    assert.equal(id.status, ItemStatus.EXPIRED);
    assert.equal(id.reasonCode, ReasonCode.EXPIRY_DATE_ABSENT);
  });

  it('names the missing field precisely', () => {
    assert.equal(
      id.reasonText,
      'government photo ID was uploaded but no expiry date was recorded, so validity cannot be verified.',
    );
    assert.equal(
      id.nextAction,
      'Re-upload a government photo ID with its expiry date recorded.',
    );
  });
});

describe('DEF-07 — a document dated after the decision date passes as valid', () => {
  // E-07's trigger: issue date after the submission date. This one is after the
  // *decision* date, which is strictly worse.
  const futureIssueDate = addDays(DECISION, 25); // 2026-04-01
  const result = bankResult([
    ...otherValidDocuments(),
    demoDocument({ id: 'doc-bank-future', documentType: 'bank_statement', issueDate: futureIssueDate }),
  ]);
  const bank = itemOf(result, 'PS-BANK-01');

  it('reproduces: the age is negative and the item is PRESENT_VALID', () => {
    assert.equal(futureIssueDate, '2026-04-01');
    assert.equal(bank.status, ItemStatus.PRESENT_VALID);
    assert.equal(bank.reasonCode, ReasonCode.VALID);
    assert.equal(bank.evaluatedDocumentId, 'doc-bank-future');
  });

  it('reproduces: the borrower-facing sentence says "-25 days old"', () => {
    assert.equal(
      bank.reasonText,
      `Issued ${futureIssueDate}; will be -25 days old on ${DECISION}, within the 30-day limit.`,
    );
    assert.equal(bank.nextAction, 'No action needed.');
  });

  it('is severe: an impossible date alone carries the file to DECISION_READY', () => {
    // The gate PRD H7 exists to enforce is bypassed by the input E-07 exists to
    // reject. No other item is defective here.
    assert.equal(result.blockingCount, 0);
    assert.equal(result.warningCount, 0);
    assert.equal(result.score, 100);
    assert.equal(result.overallStatus, OverallStatus.DECISION_READY);
  });

  it('also wins document selection, superseding a valid older statement', () => {
    // PRD §10.2 selects the latest issue date. A future date is the latest, so a
    // bogus upload displaces genuine evidence.
    const both = bankResult([
      demoDocument({
        id: 'doc-bank-real',
        documentType: 'bank_statement',
        issueDate: addDays(DECISION, -2),
      }),
      demoDocument({ id: 'doc-bank-future', documentType: 'bank_statement', issueDate: futureIssueDate }),
    ]);
    assert.equal(itemOf(both, 'PS-BANK-01').evaluatedDocumentId, 'doc-bank-future');
  });

  it('shows the engine has no demo-override flag to record, as E-07 requires', () => {
    // E-07: "Reject unless officer sets an explicit demo override flag; flag is
    // stored and surfaced on the report." No such field exists on ItemResult, so
    // even a deliberate override cannot be distinguished from a typo.
    assert.equal('demoOverride' in bank, false);
    assert.equal('demo_override' in bank, false);
    assert.deepEqual(Object.keys(bank).sort(), [
      'dateProvenance',
      'documentType',
      'evaluatedDocumentId',
      'nextAction',
      'reasonCode',
      'reasonText',
      'requirement',
      'ruleId',
      'status',
    ]);
  });

  it('records the submission date the check ignored', () => {
    // The engine never compares an issue date to the submission date, so E-07's
    // trigger condition is not detectable inside a check run at all.
    assert.ok(DEMO_SUBMISSION_DATE < futureIssueDate);
  });
});

describe('DEF-08 — two borrower-facing strings start with a lowercase word', () => {
  it('reproduces on the issue-date-absent reason', () => {
    const result = bankResult([
      demoDocument({ id: 'doc-bank', documentType: 'bank_statement', issueDate: null }),
    ]);
    const text = itemOf(result, 'PS-BANK-01').reasonText;
    assert.equal(text[0], 'b');
    assert.notEqual(text[0], text[0]!.toUpperCase());
  });

  it('reproduces on the expiry-date-absent reason', () => {
    const result = bankResult([
      demoDocument({ id: 'doc-id', documentType: 'government_id', expiryDate: null }),
    ]);
    const text = itemOf(result, 'PS-ID-01').reasonText;
    assert.equal(text[0], 'g');
    assert.notEqual(text[0], text[0]!.toUpperCase());
  });

  it('does not reproduce on any other template — all nine others capitalize', () => {
    // Sampled across every reason code the engine can emit, so the inconsistency
    // is shown to be local to one template rather than a house style.
    const samples = [
      bankResult([]).items.find((entry) => entry.ruleId === 'PS-BANK-01')!.reasonText, // No …
      bankResult([
        demoDocument({ id: 'a', documentType: 'bank_statement', issueDate: addDays(DECISION, -40) }),
      ]).items.find((entry) => entry.ruleId === 'PS-BANK-01')!.reasonText, // Will be …
      bankResult([
        demoDocument({ id: 'a', documentType: 'bank_statement', issueDate: addDays(DECISION, -26) }),
      ]).items.find((entry) => entry.ruleId === 'PS-BANK-01')!.reasonText, // Will be … warning
      bankResult([
        demoDocument({ id: 'a', documentType: 'bank_statement', issueDate: addDays(DECISION, -2) }),
      ]).items.find((entry) => entry.ruleId === 'PS-BANK-01')!.reasonText, // Issued …
      bankResult([
        demoDocument({ id: 'a', documentType: 'government_id', expiryDate: addDays(DECISION, -1) }),
      ]).items.find((entry) => entry.ruleId === 'PS-ID-01')!.reasonText, // Expires on …
      bankResult([
        demoDocument({ id: 'a', documentType: 'government_id', expiryDate: DECISION }),
      ]).items.find((entry) => entry.ruleId === 'PS-ID-01')!.reasonText, // Expires on … itself
      bankResult([
        demoDocument({ id: 'a', documentType: 'government_id', expiryDate: '2030-01-01' }),
      ]).items.find((entry) => entry.ruleId === 'PS-ID-01')!.reasonText, // Expires …
      bankResult([
        demoDocument({ id: 'a', documentType: 'address_proof', issueDate: addDays(DECISION, -1) }),
      ]).items.find((entry) => entry.ruleId === 'PS-ADR-01')!.reasonText, // Issued …
    ];

    for (const text of samples) {
      assert.equal(text[0], text[0]!.toUpperCase(), `expected a capital: "${text}"`);
    }

    // Condition-not-met and attribute-missing are driven from the EVL rule.
    const shortTenure = demoApplication({
      attributes: { employment_type: 'salaried', self_employed: false, tenure_months: 36, loan_amount: 45_000 },
    });
    const notMet = evaluate({
      application: shortTenure,
      documents: [],
      rules: salariedRuleSet(),
    }).items.find((entry) => entry.ruleId === 'PS-EVL-01')!;
    assert.equal(notMet.reasonText[0], 'N'); // Not required for this application: …

    const noAttributes = evaluate({
      application: demoApplication({ attributes: {} }),
      documents: [],
      rules: salariedRuleSet(),
    }).items.find((entry) => entry.ruleId === 'PS-EVL-01')!;
    assert.equal(noAttributes.reasonText[0], 'R'); // Rule PS-EVL-01 not evaluated: …
  });
});

describe('E-08 — expiry date earlier than issue date', () => {
  const result = bankResult([
    demoDocument({
      id: 'doc-id',
      documentType: 'government_id',
      issueDate: '2020-01-01',
      expiryDate: '2019-01-01',
    }),
  ]);
  const id = itemOf(result, 'PS-ID-01');

  it('fails closed on the hard-expiry basis', () => {
    assert.equal(id.status, ItemStatus.EXPIRED);
    assert.equal(id.reasonCode, ReasonCode.HARD_EXPIRY_PASSED);
  });

  it('does not surface the contradiction — the report reads as a normal expiry', () => {
    // Correct outcome, incomplete explanation: an officer reading this cannot tell
    // a genuinely expired ID from a data-entry error. E-08 puts detection at
    // client + server, which is not built.
    assert.equal(
      id.reasonText,
      `Expires on 2019-01-01, before the expected decision date ${DECISION}.`,
    );
    assert.equal(id.reasonText.includes('issue date'), false);
  });
});

describe('E-18 — expected decision date already in the past', () => {
  it('runs normally, but a document issued after that past date reads as valid', () => {
    const pastDecision = '2026-01-15';
    const result = evaluate({
      application: demoApplication({
        submissionDate: '2026-03-02',
        expectedDecisionDate: pastDecision,
      }),
      documents: [
        demoDocument({ id: 'doc-bank', documentType: 'bank_statement', issueDate: '2026-02-03' }),
      ],
      rules: salariedRuleSet(),
    });
    const bank = itemOf(result, 'PS-BANK-01');

    // Age is negative at a past decision date, so the item reads as valid — the
    // same DEF-07 mechanism, reached through an inconsistent SLA instead of a
    // mistyped issue date. PRD E-18 and TRD §15.1 both predict "freshness items
    // EXPIRED", which holds for documents issued *before* the past decision date
    // and does not hold for this one. The remaining freshness items are MISSING
    // here, so the file is still INCOMPLETE — for the wrong reason.
    assert.equal(bank.status, ItemStatus.PRESENT_VALID);
    assert.equal(result.overallStatus, OverallStatus.INCOMPLETE);
  });

  it('does predict EXPIRED for a document issued before the past decision date', () => {
    // The other half of E-18, so the report cannot claim the prediction is simply
    // wrong. Same past decision date; the statement predates it by 40 days, so the
    // age is positive and beyond the 30-day limit.
    const result = evaluate({
      application: demoApplication({ expectedDecisionDate: '2026-01-15' }),
      documents: [
        demoDocument({ id: 'doc-bank', documentType: 'bank_statement', issueDate: '2025-12-06' }),
      ],
      rules: salariedRuleSet(),
    });
    assert.equal(itemOf(result, 'PS-BANK-01').status, ItemStatus.EXPIRED);
  });

  it('leaves the banner to the client, which does not exist', () => {
    // PRD E-18 and TRD §15.1 both place the explanatory banner in the UI layer.
    // The engine returns the dates it used and nothing else, so there is no
    // machine-readable "these dates are inconsistent" signal for a client to key
    // off. Recorded as a known limitation, not asserted as a defect.
    const result = evaluate({
      application: demoApplication({ expectedDecisionDate: '2026-01-15' }),
      documents: [],
      rules: salariedRuleSet(),
    });
    assert.equal('datesInconsistent' in result, false);
    assert.equal('warnings' in result, false);
  });
});
