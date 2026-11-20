/**
 * @readyfile/core — shared vocabulary for web, mobile and api (TRD §3.2).
 *
 * Dependency rule (TRD §4): core depends on nothing internal. Only zod, for
 * the rule-set schema.
 */

export * from './enums.ts';
export * from './dates.ts';
export * from './document-types.ts';
export * from './rule-schema.ts';
export * from './sla.ts';
