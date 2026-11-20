import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DOCUMENT_TYPES,
  ItemStatus,
  addDays,
  type DocumentType,
  type RuleItem,
  type RuleSet,
} from '../../02_source/packages/core/src/index.ts';
import { evaluate } from '../../02_source/packages/rules-engine/src/index.ts';
import { DEMO_DECISION_DATE, demoApplication, demoDocument } from './fixtures.ts';

/**
 * Golden-file test for borrower-facing wording — method key `G`, PRD PC-19.
 *
 * PC-19 requires that freshness-failure `reason_text` embed the concrete numbers
 * (age at decision, max allowed), and names `G golden file` as its method. TRD
 * §7.3 step 5 states the same requirement of the engine, and TRD §9 stores
 * `reason_text` and `next_action` in `check_run_items`, which is insert-only — so
 * the wording is written into audit history exactly as produced. The copy is
 * therefore an interface, not an implementation detail.
 *
 * Every expected string below is hardcoded on purpose: deriving it from the same
 * label tables the engine uses would make the test tautological and would not
 * catch an accidental edit to `DOCUMENT_LABELS`.
 *
 * If a string here changes, a human must confirm the new wording is still
 * accurate for a borrower before updating the golden value.
 *
 * **Scope note.** This suite pins the strings at the engine boundary. PC-20
 * (provenance marker displayed on each item, method `E`) and PC-19's UI rendering
 * are **not** covered — no web or mobile client exists yet. See qa-report.md.
 */

const DECISION = DEMO_DECISION_DATE; // 2026-03-07

/**
 * A QA-only rule set covering all ten registry entries with the basis documented
 * in PRD §11, every one unconditional, so each can be driven to any state.
 */
const BASIS: Readonly<Record<DocumentType, { maxAge: number } | { hardExpiry: true }>> = {
  government_id: { hardExpiry: true },
  address_proof: { maxAge: 90 },
  payslips: { maxAge: 60 },
  bank_statement: { maxAge: 30 },
  tax_return: { maxAge: 365 },
  business_registration: { hardExpiry: true },
  employment_verification_letter: { maxAge: 30 },
  property_valuation_report: { maxAge: 180 },
  credit_bureau_report: { maxAge: 30 },
  insurance_certificate: { hardExpiry: true },
};

const CODE_BY_TYPE: Readonly<Record<DocumentType, string>> = {
  government_id: 'GID',
  address_proof: 'ADR',
  payslips: 'PSL',
  bank_statement: 'BANK',
  tax_return: 'TAX',
  business_registration: 'BREG',
  employment_verification_letter: 'EVL',
  property_valuation_report: 'PVR',
  credit_bureau_report: 'CBR',
  insurance_certificate: 'INS',
};

const REFERENCE_RULE_SET: RuleSet = {
  product_id: 'qa_reference_all_types',
  version: 1,
  warning_horizon_days: 7,
  items: DOCUMENT_TYPES.map(
    (documentType): RuleItem => ({
      rule_id: `QA-${CODE_BY_TYPE[documentType]}-01`,
      document_type: documentType,
      requirement: 'required',
      condition: null,
      freshness:
        'maxAge' in BASIS[documentType]
          ? { kind: 'max_age', max_age_days: BASIS[documentType].maxAge }
          : null,
      hard_expiry: 'hardExpiry' in BASIS[documentType],
    }),
  ),
};

function check(documents: Parameters<typeof evaluate>[0]['documents'], rules = REFERENCE_RULE_SET) {
  return evaluate({ application: demoApplication(), documents, rules });
}

function golden(ruleId: string, documents: Parameters<typeof evaluate>[0]['documents']) {
  const result = check(documents);
  const found = result.items.find((entry) => entry.ruleId === ruleId);
  assert.ok(found, `no result for ${ruleId}`);
  return found;
}

describe('PC-19 golden — Missing, all ten document types', () => {
  /** [document type, reason text, next action] transcribed from PRD §7.2 tone. */
  const GOLDEN: readonly (readonly [DocumentType, string, string])[] = [
    ['government_id', 'No government photo ID uploaded.', 'Upload a government photo ID with an expiry date on or after 2026-03-07.'],
    ['address_proof', 'No address proof uploaded.', 'Upload an address proof issued within the last 90 days.'],
    ['payslips', 'No payslips uploaded.', 'Upload your payslips issued within the last 60 days.'],
    ['bank_statement', 'No bank statement uploaded.', 'Upload a bank statement issued within the last 30 days.'],
    ['tax_return', 'No tax returns uploaded.', 'Upload your tax returns issued within the last 365 days.'],
    ['business_registration', 'No business registration uploaded.', 'Upload your business registration with an expiry date on or after 2026-03-07.'],
    ['employment_verification_letter', 'No employment verification letter uploaded.', 'Upload an employment verification letter issued within the last 30 days.'],
    ['property_valuation_report', 'No property valuation report uploaded.', 'Upload a property valuation report issued within the last 180 days.'],
    ['credit_bureau_report', 'No credit bureau report uploaded.', 'Upload a credit bureau report issued within the last 30 days.'],
    ['insurance_certificate', 'No insurance certificate uploaded.', 'Upload an insurance certificate with an expiry date on or after 2026-03-07.'],
  ];

  it('covers the whole registry', () => {
    assert.equal(GOLDEN.length, DOCUMENT_TYPES.length);
  });

  for (const [documentType, reasonText, nextAction] of GOLDEN) {
    it(`renders ${documentType}`, () => {
      const evaluated = golden(`QA-${CODE_BY_TYPE[documentType]}-01`, []);
      assert.equal(evaluated.status, ItemStatus.MISSING);
      assert.equal(evaluated.reasonText, reasonText);
      assert.equal(evaluated.nextAction, nextAction);
      assert.equal(evaluated.dateProvenance, null);
    });
  }
});

describe('PC-19 golden — freshness states', () => {
  it('Expired: names the age at decision and the limit', () => {
    const evaluated = golden('QA-BANK-01', [
      demoDocument({
        id: 'd1',
        documentType: 'bank_statement',
        issueDate: addDays(DECISION, -32),
      }),
    ]);
    assert.equal(evaluated.status, ItemStatus.EXPIRED);
    assert.equal(
      evaluated.reasonText,
      `Will be 32 days old on ${DECISION}; max allowed is 30 days.`,
    );
    assert.equal(
      evaluated.nextAction,
      'Upload a bank statement issued on or after 2026-02-05.',
    );
  });

  it('Expiring Soon: names the warning window', () => {
    const evaluated = golden('QA-BANK-01', [
      demoDocument({
        id: 'd1',
        documentType: 'bank_statement',
        issueDate: addDays(DECISION, -28),
      }),
    ]);
    assert.equal(evaluated.status, ItemStatus.EXPIRING_SOON);
    assert.equal(
      evaluated.reasonText,
      `Will be 28 days old on ${DECISION}; max allowed is 30 days — inside the 7-day warning window.`,
    );
    assert.equal(
      evaluated.nextAction,
      'Upload a bank statement issued on or after 2026-02-05 to clear the warning.',
    );
  });

  it('Present & Valid: states the issue date and the age at decision', () => {
    const issueDate = addDays(DECISION, -10);
    const evaluated = golden('QA-BANK-01', [
      demoDocument({ id: 'd1', documentType: 'bank_statement', issueDate }),
    ]);
    assert.equal(evaluated.status, ItemStatus.PRESENT_VALID);
    assert.equal(
      evaluated.reasonText,
      `Issued ${issueDate}; will be 10 days old on ${DECISION}, within the 30-day limit.`,
    );
    assert.equal(evaluated.nextAction, 'No action needed.');
  });

  it('no issue date recorded: fails closed and says why', () => {
    const evaluated = golden('QA-BANK-01', [
      demoDocument({ id: 'd1', documentType: 'bank_statement', issueDate: null }),
    ]);
    assert.equal(evaluated.status, ItemStatus.EXPIRED);
    assert.equal(
      evaluated.reasonText,
      'bank statement was uploaded but no issue date was recorded, so validity cannot be verified.',
    );
    assert.equal(
      evaluated.nextAction,
      'Re-upload a bank statement with its issue date recorded.',
    );
  });
});

describe('PC-19 golden — hard-expiry states', () => {
  it('expired before the decision date', () => {
    const evaluated = golden('QA-GID-01', [
      demoDocument({
        id: 'd1',
        documentType: 'government_id',
        expiryDate: addDays(DECISION, -1),
      }),
    ]);
    assert.equal(evaluated.status, ItemStatus.EXPIRED);
    assert.equal(
      evaluated.reasonText,
      `Expires on 2026-03-06, before the expected decision date ${DECISION}.`,
    );
    assert.equal(
      evaluated.nextAction,
      `Upload a government photo ID with an expiry date on or after ${DECISION}.`,
    );
  });

  it('expiring on the decision date itself', () => {
    const evaluated = golden('QA-GID-01', [
      demoDocument({ id: 'd1', documentType: 'government_id', expiryDate: DECISION }),
    ]);
    assert.equal(evaluated.status, ItemStatus.EXPIRING_SOON);
    assert.equal(
      evaluated.reasonText,
      `Expires on ${DECISION}, the expected decision date itself — valid that day, with no margin.`,
    );
    assert.equal(
      evaluated.nextAction,
      `Upload a government photo ID with an expiry date after ${DECISION}.`,
    );
  });

  it('valid beyond the decision date', () => {
    const evaluated = golden('QA-GID-01', [
      demoDocument({ id: 'd1', documentType: 'government_id', expiryDate: '2029-03-01' }),
    ]);
    assert.equal(evaluated.status, ItemStatus.PRESENT_VALID);
    assert.equal(
      evaluated.reasonText,
      `Expires 2029-03-01, on or after the expected decision date ${DECISION}.`,
    );
    assert.equal(evaluated.nextAction, 'No action needed.');
  });

  it('no expiry date recorded: fails closed and says why', () => {
    const evaluated = golden('QA-GID-01', [
      demoDocument({ id: 'd1', documentType: 'government_id', expiryDate: null }),
    ]);
    assert.equal(evaluated.status, ItemStatus.EXPIRED);
    assert.equal(
      evaluated.reasonText,
      'government photo ID was uploaded but no expiry date was recorded, so validity cannot be verified.',
    );
    assert.equal(
      evaluated.nextAction,
      'Re-upload a government photo ID with its expiry date recorded.',
    );
  });
});

describe('PC-19 golden — condition and provenance wording', () => {
  const evlRule: RuleSet = {
    product_id: 'qa_reference_conditional',
    version: 1,
    warning_horizon_days: 7,
    items: [
      {
        rule_id: 'QA-EVL-01',
        document_type: 'employment_verification_letter',
        requirement: 'conditional',
        condition: { field: 'tenure_months', op: '<', value: 12 },
        freshness: { kind: 'max_age', max_age_days: 30 },
        hard_expiry: false,
      },
      {
        rule_id: 'QA-INS-01',
        document_type: 'insurance_certificate',
        requirement: 'optional',
        condition: null,
        freshness: null,
        hard_expiry: true,
      },
    ],
  };

  it('condition not met: quotes the comparison and the actual value', () => {
    const result = evaluate({
      application: demoApplication(), // tenure_months: 36
      documents: [],
      rules: evlRule,
    });
    const evaluated = result.items.find((entry) => entry.ruleId === 'QA-EVL-01');
    assert.equal(evaluated?.status, ItemStatus.NOT_APPLICABLE);
    assert.equal(
      evaluated?.reasonText,
      "Not required for this application: 'tenure_months < 12' is not met (actual: 36).",
    );
    assert.equal(evaluated?.nextAction, 'No action needed.');
  });

  it('condition attribute absent: names the rule and the attribute (E-13)', () => {
    const result = evaluate({
      application: demoApplication({ attributes: { employment_type: 'salaried' } }),
      documents: [],
      rules: evlRule,
    });
    const evaluated = result.items.find((entry) => entry.ruleId === 'QA-EVL-01');
    assert.equal(evaluated?.status, ItemStatus.NOT_APPLICABLE);
    assert.equal(
      evaluated?.reasonText,
      "Rule QA-EVL-01 not evaluated: application attribute 'tenure_months' is not set.",
    );
    assert.equal(
      evaluated?.nextAction,
      "Set 'tenure_months' on the application, or confirm this document is not required.",
    );
  });

  it('optional and absent: says it is optional, never that it is missing', () => {
    const result = evaluate({
      application: demoApplication(),
      documents: [],
      rules: evlRule,
    });
    const evaluated = result.items.find((entry) => entry.ruleId === 'QA-INS-01');
    assert.equal(evaluated?.status, ItemStatus.NOT_APPLICABLE);
    assert.equal(
      evaluated?.reasonText,
      'Optional for this product — no insurance certificate uploaded, and none is required.',
    );
    assert.equal(
      evaluated?.nextAction,
      'Upload an insurance certificate if the borrower has one; it is not required.',
    );
  });

  it('pins the provenance string PC-20 must display (the display itself is E2E, not built)', () => {
    const result = evaluate({
      application: demoApplication(),
      documents: [
        demoDocument({
          id: 'd1',
          documentType: 'bank_statement',
          issueDate: addDays(DECISION, -10),
        }),
      ],
      rules: REFERENCE_RULE_SET,
    });
    for (const evaluated of result.items) {
      if (evaluated.ruleId === 'QA-BANK-01') {
        assert.equal(
          evaluated.dateProvenance,
          'document dates entered by officer at upload',
        );
      } else {
        assert.equal(evaluated.dateProvenance, null, evaluated.ruleId);
      }
    }
  });
});
