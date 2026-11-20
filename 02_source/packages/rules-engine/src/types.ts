import type {
  ApplicationAttributes,
  DocumentType,
  ISODate,
  ItemStatus,
  OverallStatus,
  ReasonCode,
  RequirementLevel,
  RuleSet,
} from '@readyfile/core';

/**
 * Document metadata as the engine sees it. No file bytes, no DB row — the
 * engine is pure and receives only what it needs to decide (TRD §7.3).
 */
export interface DocumentMeta {
  id: string;
  documentType: DocumentType;
  issueDate: ISODate | null;
  expiryDate: ISODate | null;
  /** ISO timestamp. Used only as a deterministic tie-break, never for age math. */
  uploadedAt: string;
  version: number;
}

export interface EvaluationApplication {
  submissionDate: ISODate;
  expectedDecisionDate: ISODate;
  attributes: ApplicationAttributes;
}

export interface ItemResult {
  ruleId: string;
  documentType: DocumentType;
  requirement: RequirementLevel;
  status: ItemStatus;
  reasonCode: ReasonCode;
  reasonText: string;
  nextAction: string;
  evaluatedDocumentId: string | null;
  dateProvenance: string | null;
}

export type StatusCounts = Readonly<Record<ItemStatus, number>>;

export interface CheckResult {
  score: number;
  overallStatus: OverallStatus;
  /** Sorted by rule_id, code-unit order — stable across runs and locales. */
  items: ItemResult[];
  countsByStatus: StatusCounts;
  /** Required (or condition-triggered) items the score is computed over. */
  applicableRequiredCount: number;
  validRequiredCount: number;
  /** Missing/Expired gate items. Non-zero means DECISION_READY is unreachable. */
  blockingCount: number;
  warningCount: number;
}

export interface EvaluateInput {
  application: EvaluationApplication;
  /** All versions of all documents for the application. */
  documents: DocumentMeta[];
  /** One immutable rule version. */
  rules: RuleSet;
  /** Defaults to the rule set's own warning_horizon_days. */
  warningHorizonDays?: number;
  /**
   * Acknowledgment state at evaluation time. Warnings are acknowledged by a
   * separate append-only event after a run (TRD §7.4), so callers recomputing a
   * derived application status pass the current value; a fresh run passes false.
   */
  warningsAcknowledged?: boolean;
}
