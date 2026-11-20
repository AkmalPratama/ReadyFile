/**
 * @readyfile/rules-engine — deterministic completeness evaluation.
 *
 * Dependency rule (TRD §4): depends only on @readyfile/core. No ORM, no Fastify,
 * no filesystem — the absence of those packages is what makes the "engine has no
 * database handle" boundary rule (TRD §7.7) a compile-time guarantee.
 */

export { evaluate } from './evaluate.ts';
export { evaluateItem, type ItemContext } from './evaluate-item.ts';
export { aggregate, isGateItem, resolveOverallStatus } from './aggregate.ts';
export { selectEvaluatedDocument } from './select-document.ts';
export { evaluateCondition, type ConditionOutcome } from './conditions.ts';

export type {
  CheckResult,
  DocumentMeta,
  EvaluationApplication,
  EvaluateInput,
  ItemResult,
  StatusCounts,
} from './types.ts';

export { ENGINE_VERSION } from '@readyfile/core';
