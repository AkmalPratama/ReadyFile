/**
 * Status vocabularies and role definitions.
 *
 * These are deliberately FIXED product logic, not configuration — see PRD §10.7.
 * The UI, API contract and audit schema all depend on them, so changing a value
 * here is a code change plus a migration, never a rule edit.
 */
export const ItemStatus = {
    PRESENT_VALID: 'PRESENT_VALID',
    MISSING: 'MISSING',
    EXPIRED: 'EXPIRED',
    EXPIRING_SOON: 'EXPIRING_SOON',
    NOT_APPLICABLE: 'NOT_APPLICABLE',
};
export const OverallStatus = {
    INCOMPLETE: 'INCOMPLETE',
    COMPLETE_WITH_WARNINGS: 'COMPLETE_WITH_WARNINGS',
    DECISION_READY: 'DECISION_READY',
};
/**
 * Severity ordering used to combine a hard-expiry result with a freshness result
 * for the same item. Higher wins.
 */
export const ITEM_STATUS_SEVERITY = {
    NOT_APPLICABLE: 0,
    PRESENT_VALID: 1,
    EXPIRING_SOON: 2,
    MISSING: 3,
    EXPIRED: 3,
};
export const Role = {
    OFFICER: 'officer',
    MANAGER: 'manager',
    UNDERWRITER: 'underwriter',
    AUDITOR: 'auditor',
};
export const ReasonCode = {
    VALID: 'VALID',
    NO_DOCUMENT: 'NO_DOCUMENT',
    FRESHNESS_AT_DECISION: 'FRESHNESS_AT_DECISION',
    EXPIRING_SOON_FRESHNESS: 'EXPIRING_SOON_FRESHNESS',
    HARD_EXPIRY_PASSED: 'HARD_EXPIRY_PASSED',
    EXPIRING_SOON_HARD_EXPIRY: 'EXPIRING_SOON_HARD_EXPIRY',
    CONDITION_NOT_MET: 'CONDITION_NOT_MET',
    CONDITION_ATTRIBUTE_MISSING: 'CONDITION_ATTRIBUTE_MISSING',
    OPTIONAL_NOT_REQUIRED: 'OPTIONAL_NOT_REQUIRED',
    /**
     * Fail-safe codes. Upload validation (PRD E-05/E-06) should make these
     * unreachable; if a required date is nonetheless absent the item cannot be
     * shown valid, so it fails closed rather than passing silently (BRD BR-01:
     * presence alone is insufficient).
     */
    ISSUE_DATE_ABSENT: 'ISSUE_DATE_ABSENT',
    EXPIRY_DATE_ABSENT: 'EXPIRY_DATE_ABSENT',
};
/** Item statuses that block the decision-ready gate (PRD §10.6, BRD BR-04). */
export const BLOCKING_STATUSES = [
    ItemStatus.MISSING,
    ItemStatus.EXPIRED,
];
/** Item statuses that count as valid toward the readiness score (PRD §10.5). */
export const SCOREABLE_VALID_STATUSES = [
    ItemStatus.PRESENT_VALID,
    ItemStatus.EXPIRING_SOON,
];
/**
 * Provenance marker required by PRD E-19 / PC-20: the report must never imply a
 * date was read from the document, because in the MVP an officer typed it.
 * Shared so web, mobile and API render identical wording (TRD §6.2).
 *
 * Says "dates", not "issue date", so it stays accurate for hard-expiry-only
 * rules where no issue date exists.
 */
export const DATE_PROVENANCE_OFFICER_ENTRY = 'document dates entered by officer at upload';
/**
 * Recorded on every check run (TRD §9) so a historical result can be replayed
 * against the exact engine that produced it (PC-30).
 */
export const ENGINE_VERSION = '0.1.0';
