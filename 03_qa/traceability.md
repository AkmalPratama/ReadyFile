# Traceability matrix

**From:** PRD v1.3 §17 acceptance criteria (PC-01 … PC-49), §9 functional requirements (PR-01 … PR-22), §14 NFRs, §8.6 exceptions.
**To:** tests in `02_source/packages/rules-engine/test/` (unit) and `03_qa/automated/` (acceptance), and scenarios in `03_qa/scenarios/`.
**Date:** 2026-11-21 · every status below reflects a test run on this date, not an intention.

## Status key

| Mark | Meaning |
| --- | --- |
| ✅ PASS | Verified by a passing automated test **at the layer PRD names** in the Method column |
| 🟡 PARTIAL | The `U`/`G` portion is verified; the `I`, `E` or `M` portion names a layer that is not built |
| 🔴 BLOCKED | No layer named in the Method column exists |
| ⚪ STRETCH | PC-48 and PC-49; not release gates |

**Release gate (PRD §17):** *"PC-01 … PC-47 all pass."*
**Actual:** of PRD's 47 release-gate criteria, **8 pass · 12 partial · 27 blocked**. **The release gate is not met.**
(PC-10a below is a criterion this QA phase added — it is not one of PRD's 47 — and it passes. PC-48 and PC-49 are stretch and are excluded from the tally.)
The 8 that pass: PC-03, PC-06, PC-07, PC-08, PC-09, PC-19, PC-28, PC-29.

---

## 17.1 Core completeness

| ID | Criterion | Threshold | Method | Status | Evidence | Gap |
| --- | --- | --- | --- | --- | --- | --- |
| PC-01 | Required item with no document ⇒ MISSING | 100% of seeded cases | U, I | 🟡 | `engine.test.ts` › *§15.1 Missing required*; `gate-enforcement.test.ts` › *H7 / PR-11* (all three products); `demo-story.test.ts` › *step 5* | No API; no seeded cases (TRD §14.3 seed script unbuilt) |
| PC-02 | Age at decision > max_age ⇒ EXPIRED | 100% of seeded cases | U, I | 🟡 | `engine.test.ts` › *§15.1 Freshness fail*; `demo-story.test.ts` › *step 4* | No API; no seeded cases |
| PC-03 | ≥1 MISSING/EXPIRED required ⇒ INCOMPLETE | 100% | U | ✅ | `gate-enforcement.test.ts` › *Gate integrity* — exhaustive sweep: every product × every document prefix × both ack states; `engine.test.ts` › *PRD §10.6* | — |
| PC-04 | All required valid, no unacknowledged warnings ⇒ DECISION_READY | 100% | U, E | 🟡 | `gate-enforcement.test.ts` › *H7 — a fully satisfied checklist* (all three products); `demo-story.test.ts` › *steps 8–10* | No web UI (WP4) |
| PC-05 | Seeded missing + expired defects correctly flagged | ≥ 95% | U golden matrix | 🟡 | `product-matrix.test.ts` (all 3 products); `demo-story.test.ts` (the expired-at-decision and missing cases); `golden-wording.test.ts` | **The seeded applications do not exist.** QA fixtures reproduce their documented shapes, which is not the same denominator as "seeded cases" |

## 17.2 Decision-date forecast

| ID | Criterion | Threshold | Method | Status | Evidence | Gap |
| --- | --- | --- | --- | --- | --- | --- |
| PC-06 | 27 days old, max_age 30, decision +5 ⇒ EXPIRED (32 > 30) | Exact | U | ✅ | `demo-story.test.ts` › *step 4* — asserts age 27 at submission, 32 at decision, `FRESHNESS_AT_DECISION`, and the exact next-action string | — |
| PC-07 | age == max_age ⇒ EXPIRING_SOON, not EXPIRED | Exact | U | ✅ | `engine.test.ts` › *§15.1 Freshness boundary* | — |
| PC-08 | age == max_age + 1 ⇒ EXPIRED | Exact | U | ✅ | `engine.test.ts` › *§15.1 Freshness fail* | — |
| PC-09 | age == max_age − warning_horizon ⇒ EXPIRING_SOON | Exact | U | ✅ | `engine.test.ts` › *§15.1 Warning boundary*, plus *added — the warned range is M − H … M inclusive* which pins all four boundaries | — |
| PC-10 | Changing the decision date re-evaluates every freshness item | 100% of freshness items | U, I | 🟡 | `decision-date.test.ts` › *PC-10* — 4/4 applicable freshness items re-evaluated at +30 and +100 days, each independently, in both directions | No API to change the date through |
| PC-10a | Hard expiry == decision ⇒ EXPIRING_SOON; == decision − 1 ⇒ EXPIRED | Exact | U | ✅ | `decision-date.test.ts` › *PC-10a*; `engine.test.ts` › *§15.1 Hard expiry boundary* and *Hard expiry fail* | — |

## 17.3 Borrower fix pack

| ID | Criterion | Threshold | Method | Status | Evidence | Gap |
| --- | --- | --- | --- | --- | --- | --- |
| PC-11 | 2 MISSING + 1 EXPIRED ⇒ exactly 1 pack, exactly 3 entries | 1 pack / 3 entries | I, E | 🔴 | — | Fix-pack generator (TRD §7.5, WP5) not built. Input side is verified: `demo-story.test.ts` produces 1 MISSING + 1 EXPIRED on the demo file |
| PC-12 | NOT_APPLICABLE never appears in the pack | 0 occurrences | U, I | 🔴 | — | No pack. `demo-story.test.ts` verifies the EVL item is NOT_APPLICABLE, which is the datum the exclusion depends on |
| PC-13 | EXPIRING_SOON appears only when `include_warnings=true` | 0 when false, N when true | I | 🔴 | — | No pack, no flag |
| PC-14 | Every entry has type, request, freshness guidance, reason | 4/4 fields, 100% | I | 🔴 | — | No pack. `golden-wording.test.ts` pins the strings a pack would be assembled from |
| PC-15 | CSV: UTF-8, header row, one row per item, opens cleanly | Byte-checked | I | 🔴 | — | No export |
| PC-16 | Cells beginning `=` `+` `-` `@` are apostrophe-prefixed | 100% | U | 🔴 | — | **Cheapest blocked criterion.** Method is `U`; the function simply does not exist yet |

## 17.4 Explainability

| ID | Criterion | Threshold | Method | Status | Evidence | Gap |
| --- | --- | --- | --- | --- | --- | --- |
| PC-17 | Every MISSING/EXPIRED/EXPIRING_SOON has non-empty reason_text **and** next_action | 100% | U, I | 🟡 | `gate-enforcement.test.ts` › *PC-17* — matrix sweep over 3 products × 7 document states × 2 ack states; all three actionable states reached; every item also carries a rule_id present in the rule set | No API. **DEF-08** is a wording defect found on this path |
| PC-18 | Every item carries a rule_id resolvable to the rule version used | 100% | I | 🔴 | Engine layer only: `gate-enforcement.test.ts` › *PC-17* asserts every result rule_id exists in the rule set that produced it | Method is `I`; there is no stored rule version to resolve against |
| PC-19 | Freshness-failure reason_text embeds the concrete numbers | 100% | **G** golden file | ✅ | `golden-wording.test.ts` — 4 suites of hardcoded literals covering all 10 document types, all freshness states, all hard-expiry states, condition and provenance wording | — |
| PC-20 | Each evaluated item displays the provenance marker (E-19) | 100% | E | 🟡 | `golden-wording.test.ts` pins the exact marker string and its presence on evaluated items and absence on unevaluated ones | Method is `E`; no UI displays it |

## 17.5 Rule sandbox

| ID | Criterion | Threshold | Method | Status | Evidence | Gap |
| --- | --- | --- | --- | --- | --- | --- |
| PC-21 | max_age 30 → 45 preview updates statuses **in preview only** | 0 historical rows modified | I, E | 🔴 | Engine-side non-mutation is proven: `replay-determinism.test.ts` › *does not mutate the rule set or document list*; `demo-story.test.ts` › *step 11* shows the original rule set still reports version 1 and the original status | No preview endpoint, no historical rows |
| PC-22 | Saving increments the version and marks it active | +1, active flag | I | 🔴 | Version increment is verified as a data property: `rule-config-gate.test.ts` › *E-20* | No `rule_versions` table, no active flag |
| PC-23 | A check run after save records the new rule version ID | Exact | I | 🔴 | — | No check runs are stored |
| PC-24 | Historical runs retain their original version and results | Byte-identical re-read | I | 🔴 | Replay property proven (`replay-determinism.test.ts`), but there is nothing stored to re-read | No persistence |
| PC-25 | Invalid rule draft is rejected | 400 with field detail | I | 🟡 | `rule-config-gate.test.ts` — 9 rejection suites: no basis, conditional without condition, required with condition, 6 bad rule_id patterns, unknown document type, duplicate rule_id, empty items, non-positive version, horizon outside 0…90, non-integer/negative max_age | Rejection is proven at the schema; the **HTTP 400 envelope** is not built. Two limitations found: unknown keys are stripped, and version sequencing is unenforceable at schema level |
| PC-26 | Edit → save → recheck with zero code changes and zero redeploys | 0 deploys | E | 🔴 | `rule-config-gate.test.ts` › *Rule-change agility* proves the change is data: the edited rule set parses, and re-evaluation needs no rebuild | No UI, no save path, no deploy pipeline to avoid |
| PC-27 | Rule-change agility: modify a rule and re-run | **< 2 minutes** | M timed rehearsal | 🟡 | **Measured:** re-evaluation median **0.007 ms**; edit-plus-rerun **0.017 ms** | The human and UI portion of the 2 minutes cannot be measured until WP5 exists |

## 17.6 Determinism, audit, and access

| ID | Criterion | Threshold | Method | Status | Evidence | Gap |
| --- | --- | --- | --- | --- | --- | --- |
| PC-28 | Same inputs + same rule version twice ⇒ byte-identical, including item order | 100% | **G** | ✅ | `replay-determinism.test.ts` — JSON round-trip replay, 5× repeat stability, all three products, document-list rotation, rule-item reversal, code-unit ordering asserted explicitly | — |
| PC-29 | Engine has no `Date.now()`, no randomness, no I/O | 0 occurrences (static check) | U, lint rule | ✅ | `replay-determinism.test.ts` › *PC-29* — static scan of every `.ts` file in `rules-engine/src` and `core/src` for 9 forbidden constructs, comments stripped; plus a behavioural test counting calls to a spied `Date.now` and `Math.random` (zero); plus a dependency check | **No lint rule is configured.** The static check is a test, so it only runs when tests run |
| PC-30 | Any historical run is replayable from stored inputs + rule version | 100% of stored runs | U replay test | 🟡 | `replay-determinism.test.ts` proves the property a store depends on: `evaluate` is a pure function of its three arguments | **0 stored runs.** Also `CheckResult` carries no engine version — see KL-03 |
| PC-31 | `check_runs` / `check_run_items` have no UPDATE or DELETE path | 0 occurrences | Static analysis, I | 🔴 | — | No persistence layer. Second-cheapest blocked criterion once Prisma lands |
| PC-32 | Every mutating action writes one AuditEvent | 100% | I | 🔴 | — | No `audit_events` table, no middleware (AD-09) |
| PC-33 | Unauthenticated request to any non-public endpoint ⇒ 401 | 100% | I | 🔴 | — | No API, no auth |
| PC-34 | Non-manager calling `PUT /products/{id}/rules` ⇒ 403 | 100% | I | 🔴 | Only built artifact: the `Role` const object in `@readyfile/core` matches TRD §12.1 exactly | No middleware, no route table (AD-08) |
| PC-35 | User A cannot read or upload to User B's application | 403/404, 100% | I | 🔴 | — | No applications, no scoping |

## 17.7 Performance, UX, and delivery

| ID | Criterion | Threshold | Method | Status | Evidence | Gap |
| --- | --- | --- | --- | --- | --- | --- |
| PC-36 | Check latency, 20 documents, local | p95 **< 500 ms** | Load script (50 sequential) | 🟡 | **Measured, engine only:** 20 documents × 9 home-loan rules, 50 sequential runs after 200 warm-ups — median **0.013 ms**, p95 **0.027 ms**, max 0.498 ms. ~18,000× inside budget. Figures are one run and jitter at the microsecond scale; the order of magnitude is stable | Measures the engine, not "the check". HTTP, DB reads and serialization are unbuilt, so end-to-end latency is unknown |
| PC-37 | Check latency, 20 documents, cloud | p95 < 2 s; hard budget 5 s | Load script | 🔴 | — | No deployment (WP7) |
| PC-38 | Web demo flow click count | ≤ 8 clicks | M rehearsal | 🔴 | — | No web UI |
| PC-39 | Mobile capture-upload tap count | ≤ 6 taps | M rehearsal | 🔴 | — | No mobile app |
| PC-40 | Status conveyed by text + icon + colour | 100% of chips | M accessibility audit | 🔴 | The text labels exist and are pinned: `DOCUMENT_LABELS` and the status vocabulary in `@readyfile/core` | No chips |
| PC-41 | WCAG AA contrast on status chips | Passes | M audit | 🔴 | — | No styles |
| PC-42 | ≥1 seeded application moves INCOMPLETE → DECISION_READY after replacements | ≥ 1 | E, I | 🟡 | `demo-story.test.ts` › *steps 8–10* — score 60 → 100, INCOMPLETE → DECISION_READY, and the bank statement resolves to the version-2 document | No seeded application; no E or I layer |
| PC-43 | Upload > 10 MB rejected with 413, no partial file | 100% | I | 🔴 | — | `MAX_UPLOAD_BYTES` exists only as a line in TRD §14.2 |
| PC-44 | Non-PDF/JPG/PNG rejected by MIME sniff despite a spoofed extension | 100% | I | 🔴 | — | No upload path |
| PC-45 | Duplicate idempotency key returns the original, no second version | 1 row | I | 🔴 | — | No idempotency key, no rows |
| PC-46 | `docker compose up` and `npm run demo` both reach a seeded state on a clean machine | Both pass | M dry run | 🔴 | — | No compose file, no `demo` script, no seed |
| PC-47 | Seed script idempotent; `seed:reset` restores the exact initial state | Identical re-run | I | 🔴 | — | No seed script |
| PC-48 | PDF fix pack export | Works | M | ⚪ 🔴 | — | Stretch; no export at all |
| PC-49 | Business-day SLA excludes weekends | Works | U | ⚪ 🔴 | `decision-date.test.ts` › *PC-49* asserts the current behaviour **is calendar-day** and that the demo decision date `2026-03-07` is a Saturday, so the gap is visible rather than assumed | Stretch; `calendarDaySla` is the only implementation. `SlaCalculator` (AD-07) is the seam |

---

## Functional requirements (PRD §9)

| ID | Requirement | Priority | Status | Note |
| --- | --- | --- | --- | --- |
| PR-01 | Create application | Must | 🔴 | No API, no DB |
| PR-02 | Load product checklist | Must | 🟡 | Rule sets exist as QA fixtures and pass the schema; nothing loads them from a store |
| PR-03 | Upload and tag document | Must | 🔴 | No upload path |
| PR-04 | Validate document metadata | Must | 🔴 | Engine fails closed on absent dates (E-05/E-06 covered); upload-time rejection unbuilt |
| PR-05 | Run completeness check | Must | ✅ | `evaluate()`. The user *trigger* is unbuilt; the evaluation itself is complete |
| PR-06 | Detect missing documents | Must | ✅ | PC-01 |
| PR-07 | Detect hard expiry | Must | ✅ | PC-10a |
| PR-08 | Detect freshness expiry | Must | ✅ | PC-02, PC-06…PC-09 |
| PR-09 | Detect expiring soon | Must | ✅ | PC-09 |
| PR-10 | Calculate readiness score | Must | ✅ | `engine.test.ts` › *PRD §10.5 — score arithmetic* |
| PR-11 | Enforce decision-ready gate | Must | 🟡 | Enforced in the engine (PC-03); server-side 409 (E-16) unbuilt |
| PR-12 | Explain each result | Must | ✅ | PC-17, PC-19 |
| PR-13 | Generate borrower fix pack | Must | 🔴 | WP5 |
| PR-14 | Export fix pack as CSV | Should | 🔴 | WP5 |
| PR-15 | Recheck application | Must | 🟡 | Re-evaluation works; no stored runs to recheck against |
| PR-16 | Preserve document versions | Should | 🟡 | Latest-issue-date selection verified incl. tie-breaks; no storage |
| PR-17 | Store check-run history | Should | 🔴 | No persistence |
| PR-18 | Dashboard view | Should | 🔴 | No UI |
| PR-19 | Rule configuration | Must | 🟡 | Schema gate built and tested; no edit surface, no store |
| PR-20 | Rule impact preview | Should | 🟡 | Preview *semantics* verified (original rule set unchanged); no preview endpoint |
| PR-21 | Conditional requirements | Should | ✅ | `conditions.ts`; all six operators; E-13 covered |
| PR-22 | Seed demo data | Must | 🔴 | TRD §14.3 unbuilt |

**Must-have requirements in PRD §9: 16** (PR-01…PR-13, PR-15, PR-19, PR-22).

| Must-have status | Count | IDs |
| --- | --- | --- |
| ✅ Done | 7 | PR-05, PR-06, PR-07, PR-08, PR-09, PR-10, PR-12 |
| 🟡 Partial | 4 | PR-02, PR-11, PR-15, PR-19 |
| 🔴 Not started | 5 | PR-01, PR-03, PR-04, PR-13, PR-22 |

Stated plainly: **7 of 16 Must-haves are done.** Every one of the 7 is an engine
behaviour. Every one of the 5 not-started items needs the API, the database or
the fix-pack generator.

Should-have requirements: 6 (PR-14, PR-16, PR-17, PR-18, PR-20, PR-21). Done: 1
(PR-21). Partial: 2 (PR-16, PR-20). Not started: 3 (PR-14, PR-17, PR-18).

## Non-functional requirements (PRD §14)

| ID | Requirement | Target | Status | Evidence |
| --- | --- | --- | --- | --- |
| NFR-01 | Performance | < 5 s for ≤ 20 documents | 🟡 | Engine p95 0.027 ms at 20 documents (PC-36). End-to-end unmeasurable |
| NFR-02 | Determinism | Same data + same rule version ⇒ same result | ✅ | PC-28, PC-29 |
| NFR-03 | Usability | Demo flow with < 1 minute of guidance | 🔴 | PC-38, PC-39 |
| NFR-04 | Configurability | Rule edits need no code change | 🟡 | PC-26/PC-27 engine half. **Caveat:** two spec gaps force code-level assumptions — see KL-01, KL-02 |
| NFR-05 | Auditability | Check-run records immutable | 🔴 | No records. Engine non-mutation verified |
| NFR-06 | Privacy | Synthetic data only | ✅ | No test or fixture contains real PII; no file bytes are created anywhere in the suite |
| NFR-07 | Portability | Runs locally or on one cloud instance | 🔴 | PC-46 |
| NFR-08 | Security baseline | Files application-scoped, no public browsing | 🔴 | No files, no scoping |
| NFR-09 | Accessibility | Text + colour, never colour alone | 🔴 | PC-40, PC-41 |

## Exceptions (PRD §8.6)

Covered scenario-by-scenario in [`scenarios/exception-scenarios.md`](scenarios/exception-scenarios.md).
Totals: **2** fully verified (E-12, E-13 — the only two PRD assigns to the
engine), **11** partially verified, **11** blocked.

## TRD §15.1 unit matrix

All **16** named rows have a `describe` block in `engine.test.ts`, titled with the
row name. Five genuine rows were added during this build (*Optional absent*,
*Required date null*, *Both bases configured*, *Full document tie*, *Determinism
under reordering*), plus three supporting suites. 65 tests / 25 suites, all
passing.

## Handoffs (PRD §5.3)

| # | Handoff | Status |
| --- | --- | --- |
| H1 | Borrower → Loan Officer | ⚪ Out of band by design |
| H2 | Loan Officer → ReadyFile | 🔴 No intake surface. **Weakest link per PRD**, and DEF-07 lands exactly here |
| H3 | ReadyFile → Loan Officer (report) | 🟡 Report *content* fully verified; no rendering |
| H4 | Re-check loop | 🟡 PC-42 |
| H5 | Fix pack → Borrower | 🔴 Out of band; no generator |
| H6 | Replacement docs → Officer | 🔴 No upload |
| H7 | Loan Officer → Underwriter (the gate) | 🟡 Engine-enforced and exhaustively swept; no API 409, no UI |
| H8 | Ops Manager pipeline visibility | 🔴 No dashboard |
| H9/H10 | Rule version / audit trail | 🔴 No store, no audit log |
