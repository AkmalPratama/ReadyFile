# Scenario set S3 — Roles, access control and audit

**Source:** TRD §12.1 *Access Control Matrix* and §12.2 *Audit Log Specification*; PRD §5 personas and §5.3 handoffs; PRD PC-32 … PC-35.
**Method key:** `I` (API integration) for every scenario below — which is why every one is blocked.

## Execution status

**All 20 scenarios in this set are 🔴 BLOCKED.** There is no authentication, no
JWT issuance, no authorization middleware, no `audit_events` table and no HTTP
surface. The only built artifact is the `Role` const object in
`@readyfile/core` (`officer | manager | underwriter | auditor`), which matches
TRD §12.1 exactly and is asserted nowhere because nothing consumes it.

PC-32, PC-33, PC-34 and PC-35 are all method `I`. None can be attempted.

## Demo users (TRD §12.1)

| Role | Persona (PRD §5) | Demo user | Purpose |
| --- | --- | --- | --- |
| `officer` | Loan officer / intake agent | `officer@demo.local` | Full working access; may **preview** but not **save** rules |
| `manager` | Operations manager + credit policy | `manager@demo.local` | Everything `officer` can, plus save rule versions and view the full audit trail |
| `underwriter` | Underwriter / credit analyst | `underwriter@demo.local` | **Read-only** on applications, reports and fix packs — this is what makes the gate meaningful |
| `auditor` | Compliance / audit | `auditor@demo.local` | **Read-only** on everything including rule versions and the complete audit trail; no write path at all |

**No borrower role exists.** Fix-pack viewing is a demo-mode read-only mobile
screen reached by deep link (PRD §6.1, stretch); it authenticates nothing.

---

## AC-01 — Officer works a file end to end

**Role:** `officer` · **Maps to:** PR-01…PR-05, PR-13, PR-15 · **PC:** PC-38

Create an application, upload and tag documents, run the check, generate the fix
pack, upload replacements, re-run. Every step succeeds. This is scenario set S1
(`demo-rehearsal.md`) executed as `officer`.

## AC-02 — Officer may preview a rule change but not save it

**Role:** `officer` · **Maps to:** PR-19, PR-20, PC-26 · **TRD §12.1 row:** *Preview rule change* ✅ / *Save rule version* ❌

1. `POST /products/personal_salaried/rules/preview` with `max_age_days` 30 → 45 → **200**, preview only.
2. `PUT /products/personal_salaried/rules` with the same draft → **403**, and an `AUTH_DENIED` audit row with `{ required_roles: ["manager"], path, method }`.

**Why this matters for the demo:** PG-05 claims configurability. Without this
boundary, the claim is *"anyone can edit compliance-relevant policy"*, which is a
worse answer than "policy authors can".

## AC-03 — Manager saves a rule version

**Role:** `manager` · **Maps to:** PR-19, PC-22, PC-23, E-20

`PUT /products/personal_salaried/rules` → **200**, version increments by 1, the
new version is marked active, and `RULE_VERSION_SAVED` is written with
`preview_ran_first`, `changed_rule_ids[]` and `diff_summary`.

## AC-04 — Manager views the full audit trail

**Role:** `manager` · **Maps to:** PC-32, TRD §12.1 *View audit trail* ✅

`GET /applications/:id/audit` → **200** with every event for that application in
`occurred_at DESC` order.

## AC-05 — Underwriter reads but cannot act

**Role:** `underwriter` · **Maps to:** PC-34, H7, TRD §12.1

| Action | Expected |
| --- | --- |
| `GET /applications`, `GET /applications/:id` | 200 |
| `GET /applications/:id/checks` | 200 |
| `GET /documents/:id/stream` | 200 |
| `GET /applications/:id/fix-pack` | 200 |
| `POST /applications` | **403** |
| `POST /applications/:id/documents` | **403** |
| `POST /applications/:id/check` | **403** |
| `POST …/ack-warnings` | **403** |
| `GET …/fix-pack.csv` | **403** |
| `POST /products/:id/rules/preview` | **403** |
| `PUT /products/:id/rules` | **403** |
| `GET /products/:id/rules` | **403** |
| `GET /applications/:id/audit` | **403** |

This is the TRD §12.1 demo script: *"Log in as `underwriter` → show that upload,
run-check, and rule-save actions are absent → attempt `PUT
/products/personal_salaried/rules` with the underwriter token → **403**, and the
denial appears in the audit trail when viewed as `auditor`. Roughly 45 seconds,
and it converts a security claim into a visible fact."*

**Note on the UI:** TRD §12.1 rule 3 requires the UI to hide unauthorized
actions so the demo never surfaces a 403. The 403 is therefore demonstrated by
calling the endpoint directly, not by clicking.

## AC-06 — Auditor reads everything, writes nothing

**Role:** `auditor` · **Maps to:** PC-32, TRD §12.2

`GET /applications/:id/audit` → **200**. `GET /products/:id/rules` → **200**.
Every mutating endpoint → **403**. There is no write path at all for this role.

## AC-07 — Unauthenticated access

**Maps to:** PC-33, SEC-04

Any non-public endpoint without a token → **401**, not 403. `POST /auth/login`
and `GET /health` are the only public routes.

## AC-08 — Expired or malformed token

**Maps to:** SEC-04, TRD §12.1 rule 4

A token past `exp` (≤ 8 hours per `JWT_TTL_HOURS`) → **401**. A token with the
role claim tampered in the payload but not re-signed → **401**. Role is read from
the signed token only, never from a header or body.

## AC-09 — Role supplied in a request header is ignored

**Maps to:** TRD §12.1 rule 4 · **PC-34**

`PUT /products/:id/rules` with an `underwriter` token plus `x-role: manager` →
**403**. This is the cheapest way to prove the control is not decorative.

## AC-10 — Cross-application access returns 404, not 403

**Maps to:** PC-35, SEC-03, TRD §12.1 rule 2

User A creates application `app_A`. User B (same `officer` role) calls
`GET /applications/app_A` → **404**. `POST /applications/app_A/documents` →
**404**. Returning 403 would leak the existence of an application the caller has
no business knowing about.

## AC-11 — Unknown capability fails closed

**Maps to:** TRD §12.1 rule 1, AD-08

A route with no entry in the route→roles table denies every role, including
`manager`. Enforcement is a single Fastify `onRequest` hook, not per-handler
checks, so a forgotten entry cannot accidentally allow.

## AC-12 — Every mutating action writes exactly one audit event

**Maps to:** PC-32 (threshold **100%**)

| Action | Event | Required `detail` keys |
| --- | --- | --- |
| Successful login | `AUTH_LOGIN` | `demo_user` |
| Bad credentials | `AUTH_FAILED` | `attempted_user` — **never the attempted password** |
| Valid token, insufficient role | `AUTH_DENIED` | `required_roles`, `path`, `method` |
| New application | `APPLICATION_CREATE` | `product_id`, `submission_date`, `processing_sla_days`, `expected_decision_date` |
| New document version | `DOCUMENT_UPLOAD` | `document_type`, `version`, `issue_date`, `expiry_date`, `demo_override`, `file_size`, `sha256` |
| Validation/MIME failure | `DOCUMENT_REJECTED` | `reason_code`, `document_type`, `declared_type`, `detected_mime` |
| File streamed | `DOCUMENT_DOWNLOAD` | `document_id` |
| Check executed | `CHECK_RUN` | `rule_version_id`, `engine_version`, `expected_decision_date`, `score`, `overall_status`, `counts_by_status`, `document_version_ids[]` |
| Rolled-back run (E-14) | `CHECK_RUN_FAILED` | `reason_code` |
| Warnings acknowledged | `WARNINGS_ACKNOWLEDGED` | `check_run_id`, `warning_count`, `acknowledged_item_ids[]` |
| Fix pack built | `FIX_PACK_GENERATED` | `check_run_id`, `entry_count`, `include_warnings` |
| CSV/PDF download | `FIX_PACK_EXPORTED` | `format`, `entry_count` |
| Sandbox preview | `RULE_PREVIEW` | `product_id`, `draft_version`, `applications_evaluated`, `status_changes` |
| New active rule version | `RULE_VERSION_SAVED` | `product_id`, `old_version`, `new_version`, `preview_ran_first`, `changed_rule_ids[]`, `diff_summary` |
| Schema validation failure | `RULE_VERSION_REJECTED` | `product_id`, `validation_errors[]` |
| Seed reset | `SEED_RESET` | `scenario_count` |

**Cross-check against DEF-07.** `DOCUMENT_UPLOAD.detail` specifies a
`demo_override` field, so the spec does contemplate the E-07 flag — but it lives
in the audit payload only. Nothing carries it into the check run or the report,
which is why `ItemResult` has no such field. See `../qa-report.md` DEF-07.

## AC-13 — The audit log answers the six compliance questions

**Maps to:** TRD §12.2, PRD §5 compliance persona, BRD pain point P5

Each must be answerable from stored events alone:

1. *Who uploaded the bank statement evaluated in check run `cr_01J…`?* → `CHECK_RUN.detail.document_version_ids` → `DOCUMENT_UPLOAD.actor_id`.
2. *Which rule version produced this result, and who set it?* → `CHECK_RUN.detail.rule_version_id` → `RULE_VERSION_SAVED`.
3. *Was the rule previewed before it was saved?* → `RULE_VERSION_SAVED.detail.preview_ran_first` (PRD E-20).
4. *Who acknowledged the warnings that let this file become decision-ready?* → `WARNINGS_ACKNOWLEDGED`.
5. *Did anyone try to bypass the gate or the sandbox?* → `AUTH_DENIED` rows.
6. *Was this document exported to the borrower, and when?* → `FIX_PACK_EXPORTED` — records the **officer's export**, not borrower receipt. PRD H5 is out of band; do not overclaim delivery tracking.

## AC-14 — Audit and check-run tables are insert-only

**Maps to:** PC-31 (threshold: **0 occurrences** of UPDATE or DELETE), NFR-05

Static analysis over the persistence layer for any UPDATE or DELETE against
`check_runs`, `check_run_items` or `audit_events`.

**Not attempted:** there is no persistence layer. This becomes a grep-able static
check the moment Prisma lands (WP1), and it is the second-cheapest blocked
criterion after PC-16.

## AC-15 — Bad credentials never leak the password

**Maps to:** TRD §12.2, SEC-04

`AUTH_FAILED.detail` contains `attempted_user` only. Assert no request body,
password hash or credential fragment appears anywhere in the audit row or the
error envelope.

## AC-16 — Borrower deep link authenticates nothing and exposes only the shared pack

**Role:** none (stretch, PRD §6.1) · **Maps to:** TRD §12.1 note, NFR-08

Opening the fix-pack deep link on mobile shows the fix pack the officer chose to
share and nothing else — no application list, no other borrowers, no scores.

**Out of scope for MVP:** no mobile app exists.

## AC-17 — Uploaded files are application-scoped

**Maps to:** NFR-08, SEC-03

No public file browsing. `GET /documents/:id/stream` for a document belonging to
another application → **404**, per AC-10.

## AC-18 — Status is conveyed by text and icon, never colour alone

**Role:** any · **Maps to:** PC-40, NFR-09 · **Method:** `M` accessibility audit

Every status chip in the report renders its label as text (*Missing*, *Expired*,
*Expiring Soon*, *Present-Valid*, *Not Applicable*) alongside colour. Verified by
inspection with colour vision simulation, or by reading the DOM with styles
disabled.

## AC-19 — WCAG AA contrast on status chips

**Maps to:** PC-41, NFR-09 · **Method:** `M` audit

All five item-status colours and three banner colours pass 4.5:1 against their
background.

## AC-20 — Denials are visible to the auditor

**Maps to:** TRD §12.1 rule 5, PC-32

After AC-02, AC-05 and AC-09 produce `AUTH_DENIED` rows, log in as `auditor` and
confirm all three appear with actor, path, method and required roles. This is the
closing beat of the access-control demo: the control is shown working, not
asserted.

---

## What is built versus what these scenarios need

| Layer needed | Status |
| --- | --- |
| `Role` vocabulary in `@readyfile/core` | ✅ Built — `officer`, `manager`, `underwriter`, `auditor`, matching TRD §12.1 |
| `POST /auth/login`, JWT issuance, `JWT_SECRET` / `JWT_TTL_HOURS` | ❌ Not built |
| Fastify `onRequest` authZ hook + route→roles table (AD-08) | ❌ Not built |
| `audit_events` table + audit middleware (AD-09) | ❌ Not built |
| Application scoping (PC-35) | ❌ Not built |
| Web UI that hides unauthorized actions | ❌ Not built |
| Mobile deep-link screen | ❌ Not built (stretch) |
