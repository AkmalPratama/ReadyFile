import { DATE_PROVENANCE_OFFICER_ENTRY, ITEM_STATUS_SEVERITY, ItemStatus, ReasonCode, daysBetween, isBefore, } from '@readyfile/core';
import { evaluateCondition } from "./conditions.js";
import * as message from "./messages.js";
import { selectEvaluatedDocument } from "./select-document.js";
function base(rule) {
    return {
        ruleId: rule.rule_id,
        documentType: rule.document_type,
        requirement: rule.requirement,
    };
}
/**
 * TRD §7.3 algorithm, steps 1–5.
 *
 * Pure: reads only its arguments, no clock, no I/O, no randomness.
 */
export function evaluateItem(rule, ctx) {
    const decisionDate = ctx.application.expectedDecisionDate;
    // Step 1 — applicability.
    if (rule.requirement === 'conditional' && rule.condition !== null) {
        const outcome = evaluateCondition(rule.condition, ctx.application.attributes);
        if (outcome.kind === 'attribute_missing') {
            return notApplicable(base(rule), ReasonCode.CONDITION_ATTRIBUTE_MISSING, message.conditionAttributeMissing({
                ruleId: rule.rule_id,
                field: rule.condition.field,
            }));
        }
        if (outcome.kind === 'not_met') {
            return notApplicable(base(rule), ReasonCode.CONDITION_NOT_MET, message.conditionNotMet({
                field: rule.condition.field,
                op: rule.condition.op,
                expected: rule.condition.value,
                actual: outcome.actual,
            }));
        }
    }
    // Step 2 — select the governing document.
    const evaluated = selectEvaluatedDocument(ctx.documents, rule.document_type);
    if (evaluated === null) {
        // An optional document that is absent is out of scope, not a gap (TRD §15.1
        // case 8). An optional document that *is* present still gets evaluated, so a
        // stale optional upload can surface as a warning (PRD §10.6).
        if (rule.requirement === 'optional') {
            return notApplicable(base(rule), ReasonCode.OPTIONAL_NOT_REQUIRED, message.optionalNotRequired({ documentType: rule.document_type }));
        }
        return {
            ...base(rule),
            status: ItemStatus.MISSING,
            reasonCode: ReasonCode.NO_DOCUMENT,
            ...message.noDocument({
                documentType: rule.document_type,
                maxAgeDays: rule.freshness?.max_age_days ?? null,
                requiresHardExpiry: rule.hard_expiry,
                decisionDate,
            }),
            evaluatedDocumentId: null,
            dateProvenance: null,
        };
    }
    // Steps 3 and 4 — both bases are evaluated; the most severe wins.
    const bases = [];
    if (rule.hard_expiry) {
        bases.push(hardExpiryBasis(rule, evaluated, decisionDate));
    }
    if (rule.freshness !== null) {
        bases.push(freshnessBasis(rule, evaluated, decisionDate, ctx.warningHorizonDays));
    }
    const decided = mostSevere(bases, rule.rule_id);
    // Step 5 — emit with provenance (PRD E-19 / PC-20).
    return {
        ...base(rule),
        status: decided.status,
        reasonCode: decided.reasonCode,
        ...decided.text,
        evaluatedDocumentId: evaluated.id,
        dateProvenance: DATE_PROVENANCE_OFFICER_ENTRY,
    };
}
/**
 * Hard expiry pushes into the array first, so on equal severity it wins the
 * reduce below — expiry date is the more concrete evidence.
 */
function mostSevere(bases, ruleId) {
    if (bases.length === 0) {
        throw new Error(`rule ${ruleId} has neither freshness nor hard_expiry; RuleSetSchema must reject this before evaluation`);
    }
    return bases.reduce((worst, candidate) => ITEM_STATUS_SEVERITY[candidate.status] > ITEM_STATUS_SEVERITY[worst.status]
        ? candidate
        : worst);
}
function hardExpiryBasis(rule, doc, decisionDate) {
    if (doc.expiryDate === null) {
        return {
            status: ItemStatus.EXPIRED,
            reasonCode: ReasonCode.EXPIRY_DATE_ABSENT,
            text: message.requiredDateAbsent({
                documentType: rule.document_type,
                missing: 'expiry date',
            }),
        };
    }
    if (isBefore(doc.expiryDate, decisionDate)) {
        return {
            status: ItemStatus.EXPIRED,
            reasonCode: ReasonCode.HARD_EXPIRY_PASSED,
            text: message.hardExpiryPassed({
                documentType: rule.document_type,
                expiryDate: doc.expiryDate,
                decisionDate,
            }),
        };
    }
    if (doc.expiryDate === decisionDate) {
        return {
            status: ItemStatus.EXPIRING_SOON,
            reasonCode: ReasonCode.EXPIRING_SOON_HARD_EXPIRY,
            text: message.hardExpiryOnDecisionDate({
                documentType: rule.document_type,
                expiryDate: doc.expiryDate,
                decisionDate,
            }),
        };
    }
    return {
        status: ItemStatus.PRESENT_VALID,
        reasonCode: ReasonCode.VALID,
        text: message.hardExpiryValid({
            documentType: rule.document_type,
            expiryDate: doc.expiryDate,
            decisionDate,
        }),
    };
}
function freshnessBasis(rule, doc, decisionDate, warningHorizonDays) {
    const maxAgeDays = rule.freshness?.max_age_days;
    if (doc.issueDate === null || maxAgeDays === undefined) {
        return {
            status: ItemStatus.EXPIRED,
            reasonCode: ReasonCode.ISSUE_DATE_ABSENT,
            text: message.requiredDateAbsent({
                documentType: rule.document_type,
                missing: 'issue date',
            }),
        };
    }
    const ageAtDecision = daysBetween(doc.issueDate, decisionDate);
    if (ageAtDecision > maxAgeDays) {
        return {
            status: ItemStatus.EXPIRED,
            reasonCode: ReasonCode.FRESHNESS_AT_DECISION,
            text: message.freshnessExpired({
                documentType: rule.document_type,
                ageAtDecision,
                decisionDate,
                maxAgeDays,
            }),
        };
    }
    // `>=`, per TRD §15.1 ("warning boundary: age = max_age − horizon ⇒
    // EXPIRING_SOON") and PRD §10.7 ("age == max_age ⇒ Expiring Soon, not
    // Expired"). The warned range is M − H … M inclusive. A strict `>` here would
    // move the boundary to M − H + 1 and contradict both documents.
    if (ageAtDecision >= maxAgeDays - warningHorizonDays) {
        return {
            status: ItemStatus.EXPIRING_SOON,
            reasonCode: ReasonCode.EXPIRING_SOON_FRESHNESS,
            text: message.freshnessExpiringSoon({
                documentType: rule.document_type,
                ageAtDecision,
                decisionDate,
                maxAgeDays,
                warningHorizonDays,
            }),
        };
    }
    return {
        status: ItemStatus.PRESENT_VALID,
        reasonCode: ReasonCode.VALID,
        text: message.freshnessValid({
            documentType: rule.document_type,
            issueDate: doc.issueDate,
            ageAtDecision,
            decisionDate,
            maxAgeDays,
        }),
    };
}
function notApplicable(itemBase, reasonCode, text) {
    return {
        ...itemBase,
        status: ItemStatus.NOT_APPLICABLE,
        reasonCode,
        ...text,
        evaluatedDocumentId: null,
        dateProvenance: null,
    };
}
