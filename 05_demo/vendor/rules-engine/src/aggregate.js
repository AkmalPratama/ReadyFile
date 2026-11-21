import { BLOCKING_STATUSES, ItemStatus, OverallStatus, SCOREABLE_VALID_STATUSES } from '@readyfile/core';
/**
 * A gate item is one capable of blocking readiness: an applicable required item.
 *
 * Optional items and NOT_APPLICABLE items never block and never count toward the
 * score (PRD §10.5, BRD BR-05). Note a conditional item whose condition *is* met
 * becomes a gate item, because its status is no longer NOT_APPLICABLE.
 */
export function isGateItem(item) {
    return item.status !== ItemStatus.NOT_APPLICABLE && item.requirement !== 'optional';
}
/** PRD §10.6. Exposed separately so a caller can recompute the derived
 *  application status after a warning-acknowledgment event without re-running
 *  the engine (TRD §7.4 — ack never mutates item results). */
export function resolveOverallStatus(input) {
    if (input.blockingCount > 0)
        return OverallStatus.INCOMPLETE;
    if (input.warningCount > 0 && !input.warningsAcknowledged) {
        return OverallStatus.COMPLETE_WITH_WARNINGS;
    }
    return OverallStatus.DECISION_READY;
}
export function aggregate(items, warningsAcknowledged) {
    const countsByStatus = {
        PRESENT_VALID: 0,
        MISSING: 0,
        EXPIRED: 0,
        EXPIRING_SOON: 0,
        NOT_APPLICABLE: 0,
    };
    let applicableRequiredCount = 0;
    let validRequiredCount = 0;
    let blockingCount = 0;
    let warningCount = 0;
    for (const item of items) {
        countsByStatus[item.status] += 1;
        // PRD §10.6 counts *any* Expiring Soon item as a warning, including optional
        // ones — a warning is information, not a gate.
        if (item.status === ItemStatus.EXPIRING_SOON) {
            warningCount += 1;
        }
        if (!isGateItem(item))
            continue;
        applicableRequiredCount += 1;
        if (SCOREABLE_VALID_STATUSES.includes(item.status)) {
            validRequiredCount += 1;
        }
        if (BLOCKING_STATUSES.includes(item.status)) {
            blockingCount += 1;
        }
    }
    // A product with no applicable required items is trivially complete.
    const score = applicableRequiredCount === 0
        ? 100
        : Math.round((validRequiredCount / applicableRequiredCount) * 100);
    return {
        score,
        overallStatus: resolveOverallStatus({
            blockingCount,
            warningCount,
            warningsAcknowledged,
        }),
        items: [...items],
        countsByStatus: countsByStatus,
        applicableRequiredCount,
        validRequiredCount,
        blockingCount,
        warningCount,
    };
}
