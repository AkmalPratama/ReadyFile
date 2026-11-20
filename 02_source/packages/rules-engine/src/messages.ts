import {
  DOCUMENT_LABELS,
  DOCUMENT_REQUEST_LABELS,
  subtractDays,
  type DocumentType,
  type ISODate,
} from '@readyfile/core';

/**
 * Reason and next-action wording.
 *
 * PC-19 requires freshness failures to embed the concrete numbers (age at
 * decision, max allowed) rather than a generic message, so every builder here
 * takes the values it interpolates. These strings are golden-file tested and
 * shared verbatim by web and mobile (TRD §6.2).
 */

export interface Message {
  reasonText: string;
  nextAction: string;
}

const NO_ACTION = 'No action needed.';

function label(type: DocumentType): string {
  return DOCUMENT_LABELS[type];
}

function requestLabel(type: DocumentType): string {
  return DOCUMENT_REQUEST_LABELS[type];
}

function formatAttributeValue(value: string | number | boolean): string {
  return typeof value === 'string' ? `'${value}'` : String(value);
}

export function freshnessExpired(input: {
  documentType: DocumentType;
  ageAtDecision: number;
  decisionDate: ISODate;
  maxAgeDays: number;
}): Message {
  const earliestAcceptable = subtractDays(input.decisionDate, input.maxAgeDays);
  return {
    reasonText: `Will be ${input.ageAtDecision} days old on ${input.decisionDate}; max allowed is ${input.maxAgeDays} days.`,
    nextAction: `Upload ${requestLabel(input.documentType)} issued on or after ${earliestAcceptable}.`,
  };
}

export function freshnessExpiringSoon(input: {
  documentType: DocumentType;
  ageAtDecision: number;
  decisionDate: ISODate;
  maxAgeDays: number;
  warningHorizonDays: number;
}): Message {
  const earliestAcceptable = subtractDays(input.decisionDate, input.maxAgeDays);
  return {
    reasonText: `Will be ${input.ageAtDecision} days old on ${input.decisionDate}; max allowed is ${input.maxAgeDays} days — inside the ${input.warningHorizonDays}-day warning window.`,
    nextAction: `Upload ${requestLabel(input.documentType)} issued on or after ${earliestAcceptable} to clear the warning.`,
  };
}

export function freshnessValid(input: {
  documentType: DocumentType;
  issueDate: ISODate;
  ageAtDecision: number;
  decisionDate: ISODate;
  maxAgeDays: number;
}): Message {
  return {
    reasonText: `Issued ${input.issueDate}; will be ${input.ageAtDecision} days old on ${input.decisionDate}, within the ${input.maxAgeDays}-day limit.`,
    nextAction: NO_ACTION,
  };
}

export function hardExpiryPassed(input: {
  documentType: DocumentType;
  expiryDate: ISODate;
  decisionDate: ISODate;
}): Message {
  return {
    reasonText: `Expires on ${input.expiryDate}, before the expected decision date ${input.decisionDate}.`,
    nextAction: `Upload ${requestLabel(input.documentType)} with an expiry date on or after ${input.decisionDate}.`,
  };
}

export function hardExpiryOnDecisionDate(input: {
  documentType: DocumentType;
  expiryDate: ISODate;
  decisionDate: ISODate;
}): Message {
  return {
    reasonText: `Expires on ${input.expiryDate}, the expected decision date itself — valid that day, with no margin.`,
    nextAction: `Upload ${requestLabel(input.documentType)} with an expiry date after ${input.decisionDate}.`,
  };
}

export function hardExpiryValid(input: {
  documentType: DocumentType;
  expiryDate: ISODate;
  decisionDate: ISODate;
}): Message {
  return {
    reasonText: `Expires ${input.expiryDate}, on or after the expected decision date ${input.decisionDate}.`,
    nextAction: NO_ACTION,
  };
}

export function noDocument(input: {
  documentType: DocumentType;
  maxAgeDays: number | null;
  requiresHardExpiry: boolean;
  decisionDate: ISODate;
}): Message {
  const guidance: string[] = [];
  if (input.maxAgeDays !== null) {
    guidance.push(`issued within the last ${input.maxAgeDays} days`);
  }
  if (input.requiresHardExpiry) {
    guidance.push(`with an expiry date on or after ${input.decisionDate}`);
  }
  const suffix = guidance.length > 0 ? ` ${guidance.join(' and ')}` : '';
  return {
    reasonText: `No ${label(input.documentType)} uploaded.`,
    nextAction: `Upload ${requestLabel(input.documentType)}${suffix}.`,
  };
}

/**
 * An optional document that was never uploaded is not a gap — it is out of scope
 * for the decision (BRD BR-05). Reported as NOT_APPLICABLE so it cannot be
 * mistaken for a MISSING required item in either client.
 */
export function optionalNotRequired(input: {
  documentType: DocumentType;
}): Message {
  return {
    reasonText: `Optional for this product — no ${label(input.documentType)} uploaded, and none is required.`,
    nextAction: `Upload ${requestLabel(input.documentType)} if the borrower has one; it is not required.`,
  };
}

export function conditionNotMet(input: {
  field: string;
  op: string;
  expected: string | number | boolean;
  actual: string | number | boolean;
}): Message {
  return {
    reasonText: `Not required for this application: '${input.field} ${input.op} ${formatAttributeValue(input.expected)}' is not met (actual: ${formatAttributeValue(input.actual)}).`,
    nextAction: NO_ACTION,
  };
}

export function conditionAttributeMissing(input: {
  ruleId: string;
  field: string;
}): Message {
  return {
    reasonText: `Rule ${input.ruleId} not evaluated: application attribute '${input.field}' is not set.`,
    nextAction: `Set '${input.field}' on the application, or confirm this document is not required.`,
  };
}

/**
 * Fail-safe wording for a document whose required date is absent. Upload
 * validation (PRD E-05/E-06) should prevent this; if it happens the item is
 * reported as unverifiable rather than allowed to pass (BRD BR-01).
 */
export function requiredDateAbsent(input: {
  documentType: DocumentType;
  missing: 'issue date' | 'expiry date';
}): Message {
  return {
    reasonText: `${label(input.documentType)} was uploaded but no ${input.missing} was recorded, so validity cannot be verified.`,
    nextAction: `Re-upload ${requestLabel(input.documentType)} with its ${input.missing} recorded.`,
  };
}
