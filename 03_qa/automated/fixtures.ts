import {
  addDays,
  type ApplicationAttributes,
  type Condition,
  type DocumentType,
  type ISODate,
  type RequirementLevel,
  type RuleItem,
  type RuleSet,
} from '../../02_source/packages/core/src/index.ts';
import type {
  DocumentMeta,
  EvaluationApplication,
} from '../../02_source/packages/rules-engine/src/index.ts';

/**
 * QA fixtures — the three demo products and the PRD §16 demo application.
 *
 * Rule values are transcribed from **PRD §11 / BRD §6.2**, not invented.
 * Where those documents do not state a value, the constant is named `ASSUMED_*`
 * and carries a comment naming the gap; each one is an open defect in
 * `03_qa/qa-report.md`. Do not silently replace an ASSUMED value with a
 * "sensible" number — the point is that the spec is silent.
 *
 * All data is synthetic (BRD NFR-03, TRD SEC-01). No real borrower information.
 *
 * QA deliberately does **not** import the unit-test fixtures inside
 * `02_source/packages/rules-engine/test/`: an acceptance suite that reuses the
 * implementation's own helpers cannot catch a mistake baked into them.
 */

// ---------------------------------------------------------------------------
// Values the spec does not state — see qa-report.md defect register
// ---------------------------------------------------------------------------

/**
 * PRD §11 gives tax returns as "Latest assessment year; MVP can use issue-date
 * proxy" with **no day count**. BRD §6.2 cites ANZ: tax notice "less than 12
 * months old". 365 is the QA assumption, not a documented value.
 */
export const ASSUMED_TAX_RETURN_MAX_AGE_DAYS = 365;

/**
 * BRD §6.2 says the insurance certificate is "Conditional (property)" and PRD
 * §11 says only "Conditional". **Neither names the application attribute.**
 * `security_type == "property"` is the QA assumption.
 */
export const ASSUMED_INSURANCE_CONDITION: Condition = {
  field: 'security_type',
  op: '==',
  value: 'property',
};

/**
 * PRD §11 documents 30 days and flags it ⚠️; BRD §6.2 finds that value
 * **contradicted** by a Tier A source (AMP: "dated within the last 60 days") and
 * recommends 60. TRD §8's example rule set already shows 60. The seed value is
 * unresolved (BRD §5.3 scope-change log, PRD OQ-7), so both are exported and
 * `evl-window-impact.test.ts` measures the difference.
 */
export const EVL_MAX_AGE_DAYS_AS_DOCUMENTED = 30;
export const EVL_MAX_AGE_DAYS_RECOMMENDED = 60;

/** TRD §8 / PRD §10.3: warnings open 7 days before a freshness breach. */
export const WARNING_HORIZON_DAYS = 7;

/** TRD §14.2 `SLA_DEFAULT_DAYS=5`; PRD §16 step 1 "five days after submission". */
export const PROCESSING_SLA_DAYS = 5;

// ---------------------------------------------------------------------------
// Rule-set builders
// ---------------------------------------------------------------------------

interface ItemFixture {
  ruleId: string;
  documentType: DocumentType;
  requirement?: RequirementLevel;
  maxAgeDays?: number;
  hardExpiry?: boolean;
  condition?: Condition;
}

function item(input: ItemFixture): RuleItem {
  return {
    rule_id: input.ruleId,
    document_type: input.documentType,
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

/** `tenure_months < 12`, per BRD §6.2 "Conditional (tenure < 1 yr)". */
const SHORT_TENURE: Condition = { field: 'tenure_months', op: '<', value: 12 };

/** BRD §6.2: Home Loan tax returns are "Conditional (self-employed)". */
const SELF_EMPLOYED: Condition = { field: 'self_employed', op: '==', value: true };

export const PRODUCT_SALARIED = 'personal_salaried';
export const PRODUCT_SELF_EMPLOYED = 'personal_self_employed';
export const PRODUCT_HOME_LOAN = 'home_loan';

/**
 * PRD §11 column "Personal — Salaried". Tax returns, business registration,
 * property valuation and insurance are all *Not applicable* to this product, so
 * the product-level rule set omits them entirely — distinct from an item
 * evaluating to the NOT_APPLICABLE status.
 */
export function salariedRuleSet(
  evlMaxAgeDays: number = EVL_MAX_AGE_DAYS_AS_DOCUMENTED,
  overrides: Partial<Pick<RuleSet, 'warning_horizon_days' | 'version'>> = {},
): RuleSet {
  return {
    product_id: PRODUCT_SALARIED,
    version: overrides.version ?? 1,
    warning_horizon_days: overrides.warning_horizon_days ?? WARNING_HORIZON_DAYS,
    items: [
      item({ ruleId: 'PS-ID-01', documentType: 'government_id', hardExpiry: true }),
      item({ ruleId: 'PS-ADR-01', documentType: 'address_proof', maxAgeDays: 90 }),
      item({ ruleId: 'PS-PSL-01', documentType: 'payslips', maxAgeDays: 60 }),
      item({ ruleId: 'PS-BANK-01', documentType: 'bank_statement', maxAgeDays: 30 }),
      item({ ruleId: 'PS-CBR-01', documentType: 'credit_bureau_report', maxAgeDays: 30 }),
      item({
        ruleId: 'PS-EVL-01',
        documentType: 'employment_verification_letter',
        maxAgeDays: evlMaxAgeDays,
        condition: SHORT_TENURE,
      }),
    ],
  };
}

/** PRD §11 column "Personal — Self-Employed". Payslips and the employment
 *  letter are Not applicable; tax returns and business registration are Required. */
export function selfEmployedRuleSet(
  overrides: Partial<Pick<RuleSet, 'warning_horizon_days' | 'version'>> = {},
): RuleSet {
  return {
    product_id: PRODUCT_SELF_EMPLOYED,
    version: overrides.version ?? 1,
    warning_horizon_days: overrides.warning_horizon_days ?? WARNING_HORIZON_DAYS,
    items: [
      item({ ruleId: 'SE-ID-01', documentType: 'government_id', hardExpiry: true }),
      item({ ruleId: 'SE-ADR-01', documentType: 'address_proof', maxAgeDays: 90 }),
      item({ ruleId: 'SE-BANK-01', documentType: 'bank_statement', maxAgeDays: 30 }),
      item({
        ruleId: 'SE-TAX-01',
        documentType: 'tax_return',
        maxAgeDays: ASSUMED_TAX_RETURN_MAX_AGE_DAYS,
      }),
      item({ ruleId: 'SE-BREG-01', documentType: 'business_registration', hardExpiry: true }),
      item({ ruleId: 'SE-CBR-01', documentType: 'credit_bureau_report', maxAgeDays: 30 }),
    ],
  };
}

/**
 * PRD §11 column "Home Loan", transcribed **as documented**.
 *
 * ⚠️ This rule set contains a spec defect, reproduced on purpose: payslips are
 * unconditionally `Required` while tax returns are merely `Conditional` on
 * `self_employed`. A self-employed home-loan applicant therefore can never
 * reach DECISION_READY. See `product-matrix.test.ts` and DEF-06.
 */
export function homeLoanRuleSet(
  evlMaxAgeDays: number = EVL_MAX_AGE_DAYS_AS_DOCUMENTED,
  overrides: Partial<Pick<RuleSet, 'warning_horizon_days' | 'version'>> = {},
): RuleSet {
  return {
    product_id: PRODUCT_HOME_LOAN,
    version: overrides.version ?? 1,
    warning_horizon_days: overrides.warning_horizon_days ?? WARNING_HORIZON_DAYS,
    items: [
      item({ ruleId: 'HL-ID-01', documentType: 'government_id', hardExpiry: true }),
      item({ ruleId: 'HL-ADR-01', documentType: 'address_proof', maxAgeDays: 90 }),
      item({ ruleId: 'HL-PSL-01', documentType: 'payslips', maxAgeDays: 60 }),
      item({ ruleId: 'HL-BANK-01', documentType: 'bank_statement', maxAgeDays: 30 }),
      item({ ruleId: 'HL-CBR-01', documentType: 'credit_bureau_report', maxAgeDays: 30 }),
      item({ ruleId: 'HL-PVR-01', documentType: 'property_valuation_report', maxAgeDays: 180 }),
      item({
        ruleId: 'HL-TAX-01',
        documentType: 'tax_return',
        maxAgeDays: ASSUMED_TAX_RETURN_MAX_AGE_DAYS,
        condition: SELF_EMPLOYED,
      }),
      item({
        ruleId: 'HL-EVL-01',
        documentType: 'employment_verification_letter',
        maxAgeDays: evlMaxAgeDays,
        condition: SHORT_TENURE,
      }),
      item({
        ruleId: 'HL-INS-01',
        documentType: 'insurance_certificate',
        hardExpiry: true,
        condition: ASSUMED_INSURANCE_CONDITION,
      }),
    ],
  };
}

export const ALL_PRODUCT_RULE_SETS: readonly RuleSet[] = [
  salariedRuleSet(),
  selfEmployedRuleSet(),
  homeLoanRuleSet(),
];

// ---------------------------------------------------------------------------
// PRD §16 demo application
// ---------------------------------------------------------------------------

/** PRD §16 step 1: a Personal Loan — Salaried application. */
export const DEMO_SUBMISSION_DATE: ISODate = '2026-03-02';

/** PRD §16 step 1: expected decision date is five days after submission. */
export const DEMO_DECISION_DATE: ISODate = addDays(
  DEMO_SUBMISSION_DATE,
  PROCESSING_SLA_DAYS,
);

/** Long tenure ⇒ PS-EVL-01 is not applicable. */
export const DEMO_ATTRIBUTES: ApplicationAttributes = {
  employment_type: 'salaried',
  self_employed: false,
  tenure_months: 36,
  loan_amount: 45_000,
};

export function demoApplication(
  overrides: Partial<EvaluationApplication> = {},
): EvaluationApplication {
  return {
    submissionDate: overrides.submissionDate ?? DEMO_SUBMISSION_DATE,
    expectedDecisionDate: overrides.expectedDecisionDate ?? DEMO_DECISION_DATE,
    attributes: overrides.attributes ?? DEMO_ATTRIBUTES,
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

export function demoDocument(input: DocumentFixture): DocumentMeta {
  return {
    id: input.id,
    documentType: input.documentType,
    issueDate: input.issueDate ?? null,
    expiryDate: input.expiryDate ?? null,
    uploadedAt: input.uploadedAt ?? `${DEMO_SUBMISSION_DATE}T09:12:00.000Z`,
    version: input.version ?? 1,
  };
}

/** PRD §16 step 2: an ID, address proof, payslip, and a bank statement issued
 *  27 days ago. Step 3: the credit bureau report is missing. */
export const DEMO_BANK_STATEMENT_ISSUE_DATE: ISODate = addDays(DEMO_SUBMISSION_DATE, -27);

export function demoDocumentsAtStep2(): DocumentMeta[] {
  return [
    demoDocument({
      id: 'doc-demo-id',
      documentType: 'government_id',
      expiryDate: '2029-03-01',
    }),
    demoDocument({
      id: 'doc-demo-adr',
      documentType: 'address_proof',
      issueDate: addDays(DEMO_SUBMISSION_DATE, -10),
    }),
    demoDocument({
      id: 'doc-demo-psl',
      documentType: 'payslips',
      issueDate: addDays(DEMO_SUBMISSION_DATE, -7),
    }),
    demoDocument({
      id: 'doc-demo-bank',
      documentType: 'bank_statement',
      issueDate: DEMO_BANK_STATEMENT_ISSUE_DATE,
    }),
  ];
}

/** PRD §16 step 8: a fresh bank statement and credit bureau report are added. */
export function demoDocumentsAtStep8(): DocumentMeta[] {
  const freshIssueDate = addDays(DEMO_DECISION_DATE, -2);
  return [
    ...demoDocumentsAtStep2(),
    demoDocument({
      id: 'doc-demo-bank-v2',
      documentType: 'bank_statement',
      issueDate: freshIssueDate,
      uploadedAt: `${DEMO_SUBMISSION_DATE}T14:05:00.000Z`,
      version: 2,
    }),
    demoDocument({
      id: 'doc-demo-cbr',
      documentType: 'credit_bureau_report',
      issueDate: freshIssueDate,
    }),
  ];
}

/** PRD §16 step 11: the sandbox raises bank-statement max age from 30 to 45. */
export const SANDBOX_BANK_STATEMENT_MAX_AGE_DAYS = 45;

export function salariedRuleSetWithSandboxChange(): RuleSet {
  const base = salariedRuleSet();
  return {
    ...base,
    // A rule-version bump, never an in-place edit (TRD §7.6 immutability).
    version: base.version + 1,
    items: base.items.map((ruleItem) =>
      ruleItem.rule_id === 'PS-BANK-01'
        ? { ...ruleItem, freshness: { kind: 'max_age', max_age_days: SANDBOX_BANK_STATEMENT_MAX_AGE_DAYS } }
        : ruleItem,
    ),
  };
}
