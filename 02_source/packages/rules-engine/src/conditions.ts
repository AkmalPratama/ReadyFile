import type { ApplicationAttributes, Condition } from '@readyfile/core';

export type ConditionOutcome =
  | { kind: 'met' }
  | { kind: 'not_met'; actual: ApplicationAttributes[string] }
  | { kind: 'attribute_missing' };

/**
 * Returns null when the two values have no meaningful ordering (mismatched
 * primitive types), so a type mismatch can never silently satisfy a condition.
 */
function compareOrdered(
  a: ApplicationAttributes[string],
  b: ApplicationAttributes[string],
): number | null {
  if (typeof a === 'number' && typeof b === 'number') {
    return a < b ? -1 : a > b ? 1 : 0;
  }
  if (typeof a === 'string' && typeof b === 'string') {
    // Code-unit comparison, not localeCompare: locale-dependent collation would
    // break determinism (TC-02).
    return a < b ? -1 : a > b ? 1 : 0;
  }
  return null;
}

/**
 * Single-comparison condition evaluation (TRD §8 — compound expressions are
 * post-MVP).
 *
 * A missing attribute is reported distinctly from an unmet one because PRD E-13
 * requires the reason text to name the absent attribute rather than silently
 * treating the rule as satisfied.
 */
export function evaluateCondition(
  condition: Condition,
  attributes: ApplicationAttributes,
): ConditionOutcome {
  const actual = attributes[condition.field];

  if (actual === undefined) {
    return { kind: 'attribute_missing' };
  }

  if (condition.op === '==' || condition.op === '!=') {
    const equal = actual === condition.value;
    const met = condition.op === '==' ? equal : !equal;
    return met ? { kind: 'met' } : { kind: 'not_met', actual };
  }

  const ordering = compareOrdered(actual, condition.value);
  if (ordering === null) {
    return { kind: 'not_met', actual };
  }

  const met =
    condition.op === '<'
      ? ordering < 0
      : condition.op === '<='
        ? ordering <= 0
        : condition.op === '>'
          ? ordering > 0
          : ordering >= 0;

  return met ? { kind: 'met' } : { kind: 'not_met', actual };
}
