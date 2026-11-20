import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ItemStatus, OverallStatus, ReasonCode, daysBetween } from '../../02_source/packages/core/src/index.ts';
import { evaluate } from '../../02_source/packages/rules-engine/src/index.ts';
import {
  DEMO_BANK_STATEMENT_ISSUE_DATE,
  DEMO_DECISION_DATE,
  DEMO_SUBMISSION_DATE,
  SANDBOX_BANK_STATEMENT_MAX_AGE_DAYS,
  demoApplication,
  demoDocumentsAtStep2,
  demoDocumentsAtStep8,
  salariedRuleSet,
  salariedRuleSetWithSandboxChange,
} from './fixtures.ts';

/**
 * PRD §16 MVP Demo Story, executed end-to-end at the engine boundary.
 *
 * This is the highest-value acceptance suite in the project: §16 is what the
 * judges watch, and step 4 is called out in the PRD as "the money moment" — a
 * bank statement that is valid today and expired at the decision date. If this
 * suite fails, the demo fails.
 *
 * Covers PRD PC-01…PC-11 (core completeness), PC-19 (explained reasons) and
 * the FR-01/FR-02/FR-08 functional requirements at the layer that exists today.
 * UI, API, fix-pack export and sandbox persistence are **not** covered — those
 * modules are not built. See qa-report.md "Known limitations".
 */

function itemAt(result: ReturnType<typeof evaluate>, ruleId: string) {
  const found = result.items.find((candidate) => candidate.ruleId === ruleId);
  assert.ok(found, `expected a result for ${ruleId}`);
  return found;
}

describe('PRD §16 steps 1–3 — the application as opened by the officer', () => {
  it('projects the decision date five calendar days after submission', () => {
    assert.equal(DEMO_SUBMISSION_DATE, '2026-03-02');
    assert.equal(DEMO_DECISION_DATE, '2026-03-07');
    assert.equal(daysBetween(DEMO_SUBMISSION_DATE, DEMO_DECISION_DATE), 5);
  });

  it('has four documents uploaded and no credit bureau report', () => {
    const documents = demoDocumentsAtStep2();
    assert.equal(documents.length, 4);
    assert.equal(
      documents.some((document) => document.documentType === 'credit_bureau_report'),
      false,
    );
  });
});

describe('PRD §16 step 4 — the bank statement is Expired at the decision date', () => {
  const result = evaluate({
    application: demoApplication(),
    documents: demoDocumentsAtStep2(),
    rules: salariedRuleSet(),
  });
  const bankStatement = itemAt(result, 'PS-BANK-01');

  it('is valid on the submission date', () => {
    // 27 days old at submission, inside the 30-day rule. Measuring here — as
    // the published market practice does — would pass this document.
    assert.equal(daysBetween(DEMO_BANK_STATEMENT_ISSUE_DATE, DEMO_SUBMISSION_DATE), 27);
  });

  it('is Expired when measured at the expected decision date', () => {
    assert.equal(daysBetween(DEMO_BANK_STATEMENT_ISSUE_DATE, DEMO_DECISION_DATE), 32);
    assert.equal(bankStatement.status, ItemStatus.EXPIRED);
    assert.equal(bankStatement.reasonCode, ReasonCode.FRESHNESS_AT_DECISION);
    assert.equal(bankStatement.evaluatedDocumentId, 'doc-demo-bank');
  });

  it('explains itself with the concrete numbers (PC-19)', () => {
    assert.equal(
      bankStatement.reasonText,
      `Will be 32 days old on ${DEMO_DECISION_DATE}; max allowed is 30 days.`,
    );
    assert.equal(
      bankStatement.nextAction,
      'Upload a bank statement issued on or after 2026-02-05.',
    );
    // The earliest acceptable issue date is decision − max_age, not today − max_age.
    assert.equal(daysBetween('2026-02-05', DEMO_DECISION_DATE), 30);
  });

  it('labels the dates as officer-entered, never as read from the document (E-19)', () => {
    assert.equal(
      bankStatement.dateProvenance,
      'document dates entered by officer at upload',
    );
  });
});

describe('PRD §16 step 5 — the credit bureau report is Missing', () => {
  const result = evaluate({
    application: demoApplication(),
    documents: demoDocumentsAtStep2(),
    rules: salariedRuleSet(),
  });
  const creditBureauReport = itemAt(result, 'PS-CBR-01');

  it('is MISSING with actionable guidance', () => {
    assert.equal(creditBureauReport.status, ItemStatus.MISSING);
    assert.equal(creditBureauReport.reasonCode, ReasonCode.NO_DOCUMENT);
    assert.equal(creditBureauReport.reasonText, 'No credit bureau report uploaded.');
    assert.equal(
      creditBureauReport.nextAction,
      'Upload a credit bureau report issued within the last 30 days.',
    );
  });

  it('is the fix-pack source: every blocked item carries a reason and a next action', () => {
    const blocked = result.items.filter(
      (candidate) =>
        candidate.status === ItemStatus.MISSING || candidate.status === ItemStatus.EXPIRED,
    );
    assert.equal(blocked.length, 2);
    for (const blockedItem of blocked) {
      assert.notEqual(blockedItem.reasonText, '');
      assert.notEqual(blockedItem.nextAction, '');
      assert.notEqual(blockedItem.nextAction, 'No action needed.');
    }
  });
});

describe('PRD §16 step 6 — the readiness banner shows Incomplete and blocks', () => {
  const result = evaluate({
    application: demoApplication(),
    documents: demoDocumentsAtStep2(),
    rules: salariedRuleSet(),
  });

  it('is INCOMPLETE with two blocking items and a score of 60', () => {
    assert.equal(result.overallStatus, OverallStatus.INCOMPLETE);
    assert.equal(result.blockingCount, 2);
    assert.equal(result.warningCount, 0);
    assert.equal(result.applicableRequiredCount, 5);
    assert.equal(result.validRequiredCount, 3);
    assert.equal(result.score, 60);
  });

  it('excludes the not-applicable employment letter from the denominator', () => {
    const evl = itemAt(result, 'PS-EVL-01');
    assert.equal(evl.status, ItemStatus.NOT_APPLICABLE);
    assert.equal(evl.reasonCode, ReasonCode.CONDITION_NOT_MET);
    assert.equal(result.countsByStatus.NOT_APPLICABLE, 1);
    // Six rules, five applicable: the score denominator is 5, not 6.
    assert.equal(result.items.length, 6);
  });

  it('passes the other three documents the officer did upload', () => {
    assert.equal(itemAt(result, 'PS-ID-01').status, ItemStatus.PRESENT_VALID);
    assert.equal(itemAt(result, 'PS-ADR-01').status, ItemStatus.PRESENT_VALID);
    assert.equal(itemAt(result, 'PS-PSL-01').status, ItemStatus.PRESENT_VALID);
  });

  it('cannot be forced to DECISION_READY by acknowledging warnings (E-16, PR-11)', () => {
    const acknowledged = evaluate({
      application: demoApplication(),
      documents: demoDocumentsAtStep2(),
      rules: salariedRuleSet(),
      warningsAcknowledged: true,
    });
    // Acknowledgment clears warnings only; it never clears a blocker.
    assert.equal(acknowledged.overallStatus, OverallStatus.INCOMPLETE);
    assert.equal(acknowledged.blockingCount, 2);
  });
});

describe('PRD §16 steps 8–10 — remediation makes the file Decision-Ready', () => {
  const result = evaluate({
    application: demoApplication(),
    documents: demoDocumentsAtStep8(),
    rules: salariedRuleSet(),
  });

  it('is DECISION_READY with a score of 100', () => {
    assert.equal(result.overallStatus, OverallStatus.DECISION_READY);
    assert.equal(result.score, 100);
    assert.equal(result.blockingCount, 0);
    assert.equal(result.warningCount, 0);
  });

  it('lets the fresh replacement bank statement supersede the expired one', () => {
    const bankStatement = itemAt(result, 'PS-BANK-01');
    assert.equal(bankStatement.evaluatedDocumentId, 'doc-demo-bank-v2');
    assert.equal(bankStatement.status, ItemStatus.PRESENT_VALID);
  });

  it('shows the improvement as a status change between the two runs', () => {
    const before = evaluate({
      application: demoApplication(),
      documents: demoDocumentsAtStep2(),
      rules: salariedRuleSet(),
    });
    // The check-run timeline (step 10) compares these two immutable results.
    assert.deepEqual(
      [before.score, before.overallStatus, before.blockingCount],
      [60, OverallStatus.INCOMPLETE, 2],
    );
    assert.deepEqual(
      [result.score, result.overallStatus, result.blockingCount],
      [100, OverallStatus.DECISION_READY, 0],
    );
  });
});

describe('PRD §16 step 11 — the policy sandbox previews a rule change', () => {
  const sandbox = salariedRuleSetWithSandboxChange();

  it('raises the bank-statement max age from 30 to 45 as a new version', () => {
    const bankRule = sandbox.items.find((candidate) => candidate.rule_id === 'PS-BANK-01');
    assert.equal(bankRule?.freshness?.max_age_days, SANDBOX_BANK_STATEMENT_MAX_AGE_DAYS);
    // TRD §7.6: versions are immutable, so a change is a bump, never an edit.
    assert.equal(sandbox.version, 2);
    assert.equal(salariedRuleSet().version, 1);
    assert.equal(
      salariedRuleSet().items.find((candidate) => candidate.rule_id === 'PS-BANK-01')?.freshness
        ?.max_age_days,
      30,
    );
  });

  it('flips the original 32-day statement from Expired to Present & Valid', () => {
    const preview = evaluate({
      application: demoApplication(),
      documents: demoDocumentsAtStep2(),
      rules: sandbox,
    });
    const bankStatement = itemAt(preview, 'PS-BANK-01');
    assert.equal(bankStatement.status, ItemStatus.PRESENT_VALID);
    assert.equal(bankStatement.evaluatedDocumentId, 'doc-demo-bank');
    assert.equal(preview.blockingCount, 1);
    assert.equal(preview.score, 80);
  });

  it('does not by itself make the file Decision-Ready — the missing report still blocks', () => {
    const preview = evaluate({
      application: demoApplication(),
      documents: demoDocumentsAtStep2(),
      rules: sandbox,
    });
    assert.equal(preview.overallStatus, OverallStatus.INCOMPLETE);
    assert.equal(itemAt(preview, 'PS-CBR-01').status, ItemStatus.MISSING);
  });

  it('leaves the historical run on the old rule version untouched', () => {
    const historical = evaluate({
      application: demoApplication(),
      documents: demoDocumentsAtStep2(),
      rules: salariedRuleSet(),
    });
    // Replay of a stored run must reproduce the stored result (E-21).
    assert.equal(itemAt(historical, 'PS-BANK-01').status, ItemStatus.EXPIRED);
    assert.equal(historical.score, 60);
  });
});
