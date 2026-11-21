/**
 * @readyfile/core — shared vocabulary for web, mobile and api (TRD §3.2).
 *
 * Dependency rule (TRD §4): core depends on nothing internal. Only zod, for
 * the rule-set schema.
 */
export * from "./enums.js";
export * from "./dates.js";
export * from "./document-types.js";
export * from "./rule-schema.js";
export * from "./sla.js";
