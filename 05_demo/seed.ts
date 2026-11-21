/**
 * 05_demo seed generator — data only, no results.
 *
 * The mockup runs the REAL engine in the browser (05_demo/vendor), so this
 * script seeds applications, documents, rule versions, users and audit events;
 * every score/status on screen is computed live by @readyfile/rules-engine.
 *
 * Run from 02_source:  node --import tsx ../05_demo/seed.ts
 * Deterministic: no wall clock, no randomness. All data is synthetic
 * (BRD NFR-03, TRD SEC-01).
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  addDays,
  ENGINE_VERSION,
  type ApplicationAttributes,
  type ISODate,
} from '../02_source/packages/core/src/index.ts';
import type { DocumentMeta } from '../02_source/packages/rules-engine/src/index.ts';
import {
  DEMO_DECISION_DATE,
  DEMO_SUBMISSION_DATE,
  PROCESSING_SLA_DAYS,
  WARNING_HORIZON_DAYS,
  demoDocumentsAtStep2,
  demoDocumentsAtStep8,
  homeLoanRuleSet,
  salariedRuleSet,
  selfEmployedRuleSet,
} from '../03_qa/automated/fixtures.ts';

const here = dirname(fileURLToPath(import.meta.url));
const D: ISODate = DEMO_SUBMISSION_DATE;
const DEC: ISODate = DEMO_DECISION_DATE;

interface DocInput {
  id: string;
  type: DocumentMeta['documentType'];
  issue?: ISODate | null;
  expiry?: ISODate | null;
  at?: string;
  version?: number;
}

function docs(prefix: string, inputs: DocInput[]): DocumentMeta[] {
  return inputs.map((d) => ({
    id: `${prefix}-${d.id}`,
    documentType: d.type,
    issueDate: d.issue ?? null,
    expiryDate: d.expiry ?? null,
    uploadedAt: d.at ?? `${D}T09:12:00.000Z`,
    version: d.version ?? 1,
  }));
}

const ids = (list: DocumentMeta[]) => list.map((d) => d.id);

interface Run {
  id: string;
  label: string;
  at: string;
  rule_version: number;
  document_ids: string[];
  warnings_acknowledged: boolean;
}

interface AuditEvent {
  at: string;
  actor: string;
  actor_role: string;
  event: string;
  detail: Record<string, unknown>;
}

interface Application {
  id: string;
  borrower: string;
  product_id: string;
  loan_amount: number;
  submission_date: ISODate;
  expected_decision_date: ISODate;
  attributes: ApplicationAttributes;
  documents: DocumentMeta[];
  runs: Run[];
  audit: AuditEvent[];
}

function app(input: {
  id: string;
  borrower: string;
  product: string;
  amount: number;
  submission?: ISODate;
  attributes: ApplicationAttributes;
  documents: DocumentMeta[];
  runLabel?: string;
  runAt?: string;
  extraAudit?: AuditEvent[];
}): Application {
  const submission = input.submission ?? D;
  const decision = addDays(submission, PROCESSING_SLA_DAYS);
  const run: Run = {
    id: `run-${input.id}-1`,
    label: input.runLabel ?? 'Intake check',
    at: input.runAt ?? `${submission}T09:20:00.000Z`,
    rule_version: 1,
    document_ids: ids(input.documents),
    warnings_acknowledged: false,
  };
  return {
    id: input.id,
    borrower: input.borrower,
    product_id: input.product,
    loan_amount: input.amount,
    submission_date: submission,
    expected_decision_date: decision,
    attributes: input.attributes,
    documents: input.documents,
    runs: [run],
    audit: [
      {
        at: `${submission}T08:55:00.000Z`,
        actor: 'officer@demo.local',
        actor_role: 'officer',
        event: 'APPLICATION_CREATE',
        detail: {
          product_id: input.product,
          submission_date: submission,
          processing_sla_days: PROCESSING_SLA_DAYS,
          expected_decision_date: decision,
        },
      },
      ...input.documents.map((d, i) => ({
        at: `${submission}T09:${String(10 + i).padStart(2, '0')}:00.000Z`,
        actor: 'officer@demo.local',
        actor_role: 'officer',
        event: 'DOCUMENT_UPLOAD',
        detail: {
          document_type: d.documentType,
          version: d.version,
          issue_date: d.issueDate,
          expiry_date: d.expiryDate,
          demo_override: false,
        },
      })),
      {
        at: run.at,
        actor: 'officer@demo.local',
        actor_role: 'officer',
        event: 'CHECK_RUN',
        detail: { rule_version_id: 1, engine_version: ENGINE_VERSION, expected_decision_date: decision },
      },
      ...(input.extraAudit ?? []),
    ],
  };
}

const salariedAttrs = (amount: number, tenure = 36): ApplicationAttributes => ({
  employment_type: 'salaried',
  self_employed: false,
  tenure_months: tenure,
  loan_amount: amount,
});

// RF-2401 — the PRD §16 demo spine, at intake (step 2).
const demoDocs = docs('2401', [
  { id: 'id', type: 'government_id', expiry: '2029-03-01' },
  { id: 'adr', type: 'address_proof', issue: addDays(D, -10) },
  { id: 'psl', type: 'payslips', issue: addDays(D, -7) },
  { id: 'bank', type: 'bank_statement', issue: addDays(D, -27) },
]);
const demoFixed = docs('2401', [
  { id: 'id', type: 'government_id', expiry: '2029-03-01' },
  { id: 'adr', type: 'address_proof', issue: addDays(D, -10) },
  { id: 'psl', type: 'payslips', issue: addDays(D, -7) },
  { id: 'bank', type: 'bank_statement', issue: addDays(D, -27) },
  { id: 'bank-v2', type: 'bank_statement', issue: addDays(DEC, -2), at: `${D}T14:05:00.000Z`, version: 2 },
  { id: 'cbr', type: 'credit_bureau_report', issue: addDays(DEC, -2), at: `${D}T14:06:00.000Z` },
]);

const applications: Application[] = [
  app({
    id: 'RF-2401',
    borrower: 'Amara Okafor',
    product: 'personal_salaried',
    amount: 45000,
    attributes: salariedAttrs(45000),
    documents: demoDocs,
    runLabel: 'Intake check (PRD §16 step 3)',
  }),
  app({
    id: 'RF-2402',
    borrower: 'Bruno Salgado',
    product: 'personal_salaried',
    amount: 30000,
    attributes: salariedAttrs(30000),
    documents: demoFixed.map((d) => ({ ...d, id: d.id.replace('2401', '2402') })),
    runLabel: 'Recheck after replacements',
    runAt: `${D}T14:10:00.000Z`,
  }),
  app({
    id: 'RF-2403',
    borrower: 'Chen Wei',
    product: 'personal_self_employed',
    amount: 60000,
    submission: '2026-03-01',
    attributes: { employment_type: 'self_employed', self_employed: true, tenure_months: 48, loan_amount: 60000 },
    documents: docs('2403', [
      { id: 'id', type: 'government_id', expiry: '2030-01-01' },
      { id: 'adr', type: 'address_proof', issue: '2026-02-17' },
      { id: 'bank', type: 'bank_statement', issue: '2026-03-03' },
      { id: 'tax', type: 'tax_return', issue: '2025-06-30' },
      { id: 'breg', type: 'business_registration', expiry: '2027-01-01' },
      { id: 'cbr', type: 'credit_bureau_report', issue: '2026-03-03' },
    ]),
  }),
  app({
    id: 'RF-2404',
    borrower: 'Dana Haddad',
    product: 'home_loan',
    amount: 250000,
    attributes: {
      employment_type: 'self_employed',
      self_employed: true,
      tenure_months: 36,
      loan_amount: 250000,
      security_type: 'property',
    },
    documents: docs('2404', [
      { id: 'id', type: 'government_id', expiry: '2028-05-01' },
      { id: 'adr', type: 'address_proof', issue: addDays(D, -15) },
      { id: 'bank', type: 'bank_statement', issue: addDays(DEC, -4) },
      { id: 'cbr', type: 'credit_bureau_report', issue: addDays(DEC, -4) },
      { id: 'pvr', type: 'property_valuation_report', issue: addDays(D, -40) },
      { id: 'tax', type: 'tax_return', issue: '2025-06-30' },
      { id: 'ins', type: 'insurance_certificate', expiry: '2027-03-01' },
    ]),
    runLabel: 'Intake check — payslips unobtainable (DEF-06)',
  }),
  app({
    id: 'RF-2405',
    borrower: 'Elena Marsh',
    product: 'home_loan',
    amount: 320000,
    attributes: {
      employment_type: 'salaried',
      self_employed: false,
      tenure_months: 36,
      loan_amount: 320000,
      security_type: 'property',
    },
    documents: docs('2405', [
      { id: 'id', type: 'government_id', expiry: '2028-05-01' },
      { id: 'adr', type: 'address_proof', issue: addDays(D, -15) },
      { id: 'psl', type: 'payslips', issue: addDays(D, -7) },
      { id: 'bank', type: 'bank_statement', issue: addDays(DEC, -4) },
      { id: 'cbr', type: 'credit_bureau_report', issue: addDays(DEC, -4) },
      { id: 'pvr', type: 'property_valuation_report', issue: addDays(D, -40) },
      { id: 'ins', type: 'insurance_certificate', expiry: '2027-03-01' },
    ]),
  }),
  app({
    id: 'RF-2406',
    borrower: 'Farid Rahim',
    product: 'personal_salaried',
    amount: 20000,
    attributes: salariedAttrs(20000),
    documents: docs('2406', [
      { id: 'id', type: 'government_id', expiry: '2029-03-01' },
      { id: 'adr', type: 'address_proof', issue: addDays(D, -10) },
      { id: 'psl', type: 'payslips', issue: addDays(D, -7) },
      { id: 'bank', type: 'bank_statement', issue: addDays(DEC, -25) },
      { id: 'cbr', type: 'credit_bureau_report', issue: addDays(DEC, -2) },
    ]),
    runLabel: 'Intake check — statement inside the warning window',
  }),
  app({
    id: 'RF-2407',
    borrower: 'Gita Novak',
    product: 'personal_salaried',
    amount: 15000,
    attributes: salariedAttrs(15000),
    documents: docs('2407', [
      { id: 'id', type: 'government_id', expiry: '2029-03-01' },
      { id: 'adr', type: 'address_proof', issue: addDays(D, -10) },
      { id: 'psl', type: 'payslips', issue: addDays(D, -7) },
      { id: 'bank', type: 'bank_statement', issue: '2026-04-01' },
    ]),
    runLabel: 'Intake check — future-dated statement (DEF-07)',
  }),
];

// The demo spine keeps its step-8 document set available as upload suggestions.
const seed = {
  meta: {
    seed_version: 1,
    engine_version: ENGINE_VERSION,
    processing_sla_days: PROCESSING_SLA_DAYS,
    warning_horizon_days: WARNING_HORIZON_DAYS,
    rule_source: 'PRD §11 / BRD §6.2, transcribed in 03_qa/automated/fixtures.ts',
    generated_by: '05_demo/seed.ts',
    data_policy: 'Synthetic demo data only (BRD NFR-03, TRD SEC-01). No real borrower information.',
    backend: 'none — the delivery layer is a mockup; the engine runs in the browser from 05_demo/vendor',
  },
  users: [
    { role: 'officer', email: 'officer@demo.local', name: 'Olivia Officer' },
    { role: 'manager', email: 'manager@demo.local', name: 'Marcus Manager' },
    { role: 'underwriter', email: 'underwriter@demo.local', name: 'Uma Underwriter' },
    { role: 'auditor', email: 'auditor@demo.local', name: 'Ade Auditor' },
  ],
  // TRD §12.1 permission matrix, verbatim capability → roles.
  permissions: {
    create_application: ['officer', 'manager'],
    view_applications: ['officer', 'manager', 'underwriter', 'auditor'],
    upload_document: ['officer', 'manager'],
    download_document: ['officer', 'manager', 'underwriter', 'auditor'],
    run_check: ['officer', 'manager'],
    view_history: ['officer', 'manager', 'underwriter', 'auditor'],
    ack_warnings: ['officer', 'manager'],
    view_fix_pack: ['officer', 'manager', 'underwriter'],
    export_fix_pack_csv: ['officer', 'manager'],
    preview_rules: ['officer', 'manager'],
    save_rules: ['manager'],
    view_rules: ['officer', 'manager', 'auditor'],
    view_audit: ['manager', 'auditor'],
  } as Record<string, string[]>,
  products: [
    { id: 'personal_salaried', name: 'Personal Loan — Salaried', rule_set: salariedRuleSet() },
    { id: 'personal_self_employed', name: 'Personal Loan — Self-Employed', rule_set: selfEmployedRuleSet() },
    { id: 'home_loan', name: 'Home Loan', rule_set: homeLoanRuleSet() },
  ],
  applications,
  demo_suggestions: {
    'RF-2401': demoFixed.filter((d) => d.version === 2 || d.documentType === 'credit_bureau_report'),
  },
};

writeFileSync(join(here, 'seed.json'), JSON.stringify(seed, null, 2) + '\n');
console.log(
  `seed.json written: ${applications.length} applications, ` +
    `${applications.reduce((n, a) => n + a.documents.length, 0)} documents, ` +
    `${seed.products.length} rule sets`,
);