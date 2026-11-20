import type { RuleItem, RuleSet } from '@readyfile/core';
import { aggregate } from './aggregate.ts';
import { evaluateItem } from './evaluate-item.ts';
import type { CheckResult, EvaluateInput } from './types.ts';

/**
 * The completeness engine (TRD §7.3).
 *
 * Pure and total over schema-valid inputs: no `Date.now()`, no I/O, no
 * randomness, no network. Every date arrives as an argument, so the same inputs
 * and the same rule version always produce a byte-identical result (TC-02,
 * NFR-02, PC-28). The rule set is validated by RuleSetSchema at save time
 * (TRD §7.6), not here — re-validating on every check would cost the < 10 ms
 * budget for no benefit.
 */
export function evaluate(input: EvaluateInput): CheckResult {
  const warningHorizonDays =
    input.warningHorizonDays ?? input.rules.warning_horizon_days;

  const items = sortedRules(input.rules).map((rule) =>
    evaluateItem(rule, {
      application: input.application,
      documents: input.documents,
      warningHorizonDays,
    }),
  );

  return aggregate(items, input.warningsAcknowledged ?? false);
}

/**
 * Code-unit ordering, deliberately not `localeCompare` — ICU collation varies by
 * runtime locale and would make item order environment-dependent.
 */
function sortedRules(rules: RuleSet): RuleItem[] {
  return [...rules.items].sort((a, b) =>
    a.rule_id < b.rule_id ? -1 : a.rule_id > b.rule_id ? 1 : 0,
  );
}
