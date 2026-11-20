import { z } from 'zod';
import { DOCUMENT_TYPES, type DocumentType } from './document-types.ts';
import { isISODate } from './dates.ts';

/**
 * Rule-set schema — TRD §8.
 *
 * This is the single gate between "policy author edits JSON" and "engine
 * evaluates it". Everything the engine trusts about a rule set is established
 * here, so the engine itself needs no defensive checks (TC-05, PC-25).
 */

export const isoDateSchema = z
  .string()
  .refine(isISODate, { message: 'expected an ISO date YYYY-MM-DD' });

export const ConditionOpSchema = z.enum(['<', '<=', '>', '>=', '==', '!=']);
export type ConditionOp = z.infer<typeof ConditionOpSchema>;

/**
 * Single comparison only — compound AND/OR expressions are post-MVP (TRD §8).
 */
export const ConditionSchema = z.object({
  field: z.string().min(1),
  op: ConditionOpSchema,
  value: z.union([z.string(), z.number(), z.boolean()]),
});
export type Condition = z.infer<typeof ConditionSchema>;

export const FreshnessSchema = z.object({
  kind: z.literal('max_age'),
  max_age_days: z.number().int().min(0),
});
export type Freshness = z.infer<typeof FreshnessSchema>;

export const RequirementLevelSchema = z.enum(['required', 'conditional', 'optional']);
export type RequirementLevel = z.infer<typeof RequirementLevelSchema>;

/**
 * `Object.values` is not statically a tuple, and z.enum needs one to recover the
 * literal union instead of widening to `string`. Safe because DocumentType is a
 * non-empty const object.
 */
const DOCUMENT_TYPE_TUPLE = DOCUMENT_TYPES as readonly [
  DocumentType,
  ...DocumentType[],
];

export const DocumentTypeSchema = z.enum(DOCUMENT_TYPE_TUPLE);

const RULE_ID_PATTERN = /^[A-Z]{2}-[A-Z]+-\d{2}$/;

export const RuleItemSchema = z
  .object({
    rule_id: z
      .string()
      .regex(RULE_ID_PATTERN, 'rule_id must match XX-YYYY-NN, e.g. PS-BANK-01'),
    document_type: DocumentTypeSchema,
    requirement: RequirementLevelSchema,
    condition: ConditionSchema.nullable(),
    freshness: FreshnessSchema.nullable(),
    hard_expiry: z.boolean(),
  })
  .superRefine((item, ctx) => {
    if (item.requirement === 'conditional' && item.condition === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['condition'],
        message: "condition is required when requirement is 'conditional'",
      });
    }
    if (item.requirement !== 'conditional' && item.condition !== null) {
      ctx.addIssue({
        code: 'custom',
        path: ['condition'],
        message: `condition must be null when requirement is '${item.requirement}'`,
      });
    }
    // A rule with neither basis cannot be evaluated, so it must never reach the
    // engine (TRD §15.1 "Unknown rule combination").
    if (item.freshness === null && item.hard_expiry === false) {
      ctx.addIssue({
        code: 'custom',
        path: ['freshness'],
        message: 'a rule needs at least one of freshness or hard_expiry',
      });
    }
  });

export type RuleItem = z.infer<typeof RuleItemSchema>;

export const RuleSetSchema = z
  .object({
    product_id: z.string().min(1),
    version: z.number().int().positive(),
    warning_horizon_days: z.number().int().min(0).max(90).default(7),
    items: z.array(RuleItemSchema).min(1),
  })
  .superRefine((set, ctx) => {
    const seen = new Map<string, number>();
    for (const [index, item] of set.items.entries()) {
      const prior = seen.get(item.rule_id);
      if (prior !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['items', index, 'rule_id'],
          message: `duplicate rule_id '${item.rule_id}' (also at items[${prior}])`,
        });
      } else {
        seen.set(item.rule_id, index);
      }
    }
  });

export type RuleSet = z.infer<typeof RuleSetSchema>;

/**
 * Application attributes feed condition evaluation. Kept to JSON primitives so
 * a rule set stored in jsonb/TEXT round-trips without loss (TRD §9).
 */
export const ApplicationAttributesSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean()]),
);
export type ApplicationAttributes = z.infer<typeof ApplicationAttributesSchema>;

export const DEFAULT_WARNING_HORIZON_DAYS = 7;
export const DEFAULT_PROCESSING_SLA_DAYS = 5;
