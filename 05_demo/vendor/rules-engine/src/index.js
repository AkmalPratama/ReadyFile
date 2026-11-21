/**
 * @readyfile/rules-engine — deterministic completeness evaluation.
 *
 * Dependency rule (TRD §4): depends only on @readyfile/core. No ORM, no Fastify,
 * no filesystem — the absence of those packages is what makes the "engine has no
 * database handle" boundary rule (TRD §7.7) a compile-time guarantee.
 */
export { evaluate } from "./evaluate.js";
export { evaluateItem } from "./evaluate-item.js";
export { aggregate, isGateItem, resolveOverallStatus } from "./aggregate.js";
export { selectEvaluatedDocument } from "./select-document.js";
export { evaluateCondition } from "./conditions.js";
export { ENGINE_VERSION } from '@readyfile/core';
