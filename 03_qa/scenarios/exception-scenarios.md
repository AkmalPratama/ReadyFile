# Scenario set S2 — Exception catalogue

**Source:** PRD §8.6 *Exception Catalogue*, E-01 … E-24, transcribed one-to-one.
**Blocking key (PRD):** 🔴 blocks the action · 🟡 permits with visible warning · 🟢 non-blocking

## Execution status legend

| Mark | Meaning |
| --- | --- |
| 🔵 AUTOMATED | Fully verified by a passing test in `03_qa/automated/` or `02_source/packages/*/test/`. |
| 🟡 PARTIAL | The engine or schema layer is automated; the detection point PRD names (client, server, API status code, export, banner) is not built. |
| 🔴 BLOCKED | No automated cover and no way to execute — the component PRD assigns detection to does not exist. |

**Summary:** of the 24 exceptions, **2** are fully verified (E-12, E-13), **11**
are partially verified, and **11** are blocked. Counts and evidence in
`../qa-report.md`.

Nothing here has been manually executed. PRD marks only E-12 and E-13 as
detected at the **Engine**; every other row assigns detection to a client, a
server, an export generator, or an audit reviewer (E-18 is shared between the
engine and the client, E-19 is explicitly undetectable, E-21 is a design
constraint on the store). Those layers do not exist in the repository, so 22 of
24 exceptions cannot be exercised as written no matter how correct the engine is.

---

## Group 1 — Upload and document metadata

### EX-01 · E-01 — File exceeds 10 MB 🔴

| | |
| --- | --- |
| Persona | Loan officer |
| Detected at (PRD) | Client + server (413) |
| Block | 🔴 |
| Maps to | PC-43, TRD SEC-02 |
| Automated cover | None |

**Steps:** attach a 14 MB PDF to a Salaried application and submit.
**Expected:** rejected before the transfer completes where possible; no partial
file stored; message *"File is 14 MB. Maximum is 10 MB."*; server responds 413.
**Why blocked:** no upload endpoint, no storage driver, no size limit
configuration. `MAX_UPLOAD_BYTES=10485760` appears in TRD §14.2 but nothing
reads it.

### EX-02 · E-02 — Unsupported file type 🔴

| | |
| --- | --- |
| Detected at (PRD) | Client + server MIME sniff (415) |
| Block | 🔴 |
| Maps to | TRD SEC-02 |
| Automated cover | None |

**Steps:** attach `report.gif`; then attach `report.pdf` that is really a GIF.
**Expected:** both rejected with *"Only PDF, JPG and PNG are accepted."*; 415.
**Why blocked:** no MIME sniffing. The allowlist exists only as prose.

### EX-03 · E-03 — Extension / content mismatch 🔴

| | |
| --- | --- |
| Detected at (PRD) | Server MIME sniff |
| Block | 🔴 |
| Maps to | PC-44, TRD SEC-02 |
| Automated cover | None |

**Steps:** rename an executable to `statement.pdf` and upload.
**Expected:** rejected on magic bytes, not extension; logged as a security event;
*"File content does not match its extension."*
**Why blocked:** no upload path and no audit log to record the security event.

### EX-04 · E-04 — Document type not in this product's checklist 🟡

| | |
| --- | --- |
| Detected at (PRD) | Client + server |
| Block | 🔴 |
| Maps to | PR-02, PRD §11 |
| Automated cover | ✅ `automated/product-matrix.test.ts` proves which types belong to which product: rules plus *Not applicable* cells exactly partition the 10-type registry in all three products. The rejection itself is not built. |

**Steps:** on a Personal Loan — Salaried application, try to tag an upload as
*Business registration*.
**Expected:** rejected; the valid list is offered; *"'Business registration' is
not required for Personal Loan — Salaried."*
**Verified part:** the membership question the rejection depends on is answered
correctly and is under test. **Unverified part:** nothing rejects the upload.

### EX-05 · E-05 — Issue date missing on a freshness-based type 🟡

| | |
| --- | --- |
| Detected at (PRD) | Client + server |
| Block | 🔴 |
| Maps to | PR-04 |
| Automated cover | ✅ `automated/invalid-metadata.test.ts` › *"E-05"* — the engine fails closed with `EXPIRED` / `ISSUE_DATE_ABSENT` and explains why. Upload-time rejection is not built. |

**Steps:** upload a bank statement and leave the issue date empty; save.
**Expected:** save rejected with *"Issue date is required for bank statements."*
**Verified part:** if such a document ever reaches the engine it is treated as
Expired, never as valid — BRD BR-01, presence alone is insufficient.
**Defect found on this path:** **DEF-08**, the reason string starts lowercase.

### EX-06 · E-06 — Expiry date missing on a hard-expiry type 🟡

| | |
| --- | --- |
| Detected at (PRD) | Client + server |
| Block | 🔴 |
| Maps to | PR-04 |
| Automated cover | ✅ `automated/invalid-metadata.test.ts` › *"E-06"* — `EXPIRED` / `EXPIRY_DATE_ABSENT`. Upload-time rejection is not built. |

**Steps:** upload a government photo ID and leave the expiry date empty; save.
**Expected:** save rejected with *"Expiry date is required for government photo
ID."*
**Verified part:** fails closed at the engine. **Defect:** DEF-08 again.

### EX-07 · E-07 — Issue date after the submission date 🔴 (and **DEF-07**)

| | |
| --- | --- |
| Detected at (PRD) | Client + server |
| Block | 🟡 permits with a stored **demo override** flag surfaced on the report |
| Maps to | H2 failure mode, PRD §5.3 |
| Automated cover | ⚠️ `automated/invalid-metadata.test.ts` › *"DEF-07"* — reproduces the defect. There is no correct behaviour to cover yet. |

**Steps:** upload a bank statement with issue date `2026-04-01` on an application
submitted `2026-03-02` with a decision date of `2026-03-07`.
**Expected (PRD):** rejected unless the officer sets an explicit demo-override
flag; the flag is stored and surfaced on the report.
**Actual (measured):** accepted by the engine as **Present-Valid** with the
reason *"Issued 2026-04-01; will be **-25 days old** on 2026-03-07, within the
30-day limit."* With every other document valid, the file scores **100** and
reaches **Decision-Ready**. The future-dated document also wins selection under
PRD §10.2 and supersedes a genuine older statement.

**This is DEF-07, severity Major.** The decision-ready gate (H7, PR-11, FR-08) is
bypassed by exactly the input E-07 exists to reject. `ItemResult` has no
demo-override field, so a deliberate override cannot be distinguished from a
typo. Fixing it is a spec decision — validate at upload, clamp at the engine, or
both — so the behaviour is reproduced and reported, not silently changed.

### EX-08 · E-08 — Expiry date before issue date 🟡

| | |
| --- | --- |
| Detected at (PRD) | Client + server |
| Block | 🔴 |
| Maps to | PR-04 |
| Automated cover | ✅ `automated/invalid-metadata.test.ts` › *"E-08"* — pins the fail-closed outcome and records that the contradiction is not surfaced. |

**Steps:** upload a government photo ID issued `2020-01-01`, expiring
`2019-01-01`.
**Expected:** rejected with *"Expiry date cannot be earlier than issue date."*
**Actual at the engine:** `EXPIRED` / `HARD_EXPIRY_PASSED` — the right outcome by
accident. The report reads as an ordinary expired ID; an officer cannot tell a
data-entry error from a genuine expiry. Recorded as a limitation, not a defect:
PRD assigns detection elsewhere.

### EX-09 · E-09 — Duplicate idempotency key 🔴

| | |
| --- | --- |
| Detected at (PRD) | Server (409) |
| Block | 🟢 |
| Maps to | PC-45 |
| Automated cover | None |

**Steps:** upload with idempotency key `K`; simulate a network failure; retry
with the same key.
**Expected:** the **original** stored document is returned; no second version is
created; *"This upload was already received."*
**Why blocked:** no upload endpoint, no idempotency-key column, no database.

### EX-10 · E-10 — Upload interrupted 🔴

| | |
| --- | --- |
| Detected at (PRD) | Client |
| Block | 🟡 |
| Automated cover | None |

**Steps:** kill the network mid-upload.
**Expected:** one automatic retry with the same idempotency key, then a manual
*"Tap to retry."*
**Why blocked:** no client of either kind.

---

## Group 2 — Check execution

### EX-11 · E-11 — Product has no active rule version 🔴

| | |
| --- | --- |
| Detected at (PRD) | Server (409) |
| Block | 🔴 |
| Maps to | PR-02, PC-22 |
| Automated cover | None — `RuleSetSchema` validates a rule set that is handed to it; it has no notion of "active" because there is no store. |

**Steps:** call the check on a product whose `active_rule_version_id` is null.
**Expected:** refused with *"No active checklist for this product. Activate a
rule version first."*; no partial check run persisted.

### EX-12 · E-12 — Application has zero documents 🔵

| | |
| --- | --- |
| Detected at (PRD) | Engine |
| Block | 🟢 |
| Maps to | PC-01, PC-03 |
| Automated cover | ✅ `02_source/packages/rules-engine/test/engine.test.ts` › *"Empty application"*; ✅ `automated/gate-enforcement.test.ts` › *"H7 / PR-11"* (one Missing blocks in each of the three products). |

**Steps:** create an application, upload nothing, run the check.
**Expected:** runs normally, no error; every required item `MISSING`; score **0**;
status **Incomplete**.
**Verified.** This is one of only two exceptions PRD assigns to the engine, and it
is fully covered.

### EX-13 · E-13 — Conditional rule references an absent attribute 🔵

| | |
| --- | --- |
| Detected at (PRD) | Engine |
| Block | 🟡 |
| Maps to | PR-21, TRD §7.3 step 1 |
| Automated cover | ✅ `02_source/.../engine.test.ts` › *"Conditional attribute absent"*; ✅ `automated/golden-wording.test.ts` pins the exact message. |

**Steps:** run a check on an application whose `attributes` omit `tenure_months`.
**Expected:** `NOT_APPLICABLE` with reason
**`Rule PS-EVL-01 not evaluated: application attribute 'tenure_months' is not set.`**
— never silently treated as satisfied.
**Verified**, including the exact string.

### EX-14 · E-14 — Check run persists but item rows fail 🔴

| | |
| --- | --- |
| Detected at (PRD) | Server transaction |
| Block | 🔴 |
| Maps to | NFR-05, PC-31 |
| Automated cover | None |

**Steps:** force `check_run_items` insertion to fail after the `check_runs` row
commits.
**Expected:** the whole run rolls back in one transaction; no partial run is ever
visible; *"Check could not be saved. Please re-run."*
**Why blocked:** no database, no transaction, no Prisma schema.

### EX-15 · E-15 — Re-check with no new documents 🟡

| | |
| --- | --- |
| Detected at (PRD) | Server |
| Block | 🟢 |
| Maps to | NFR-02, PC-28 |
| Automated cover | ✅ `automated/replay-determinism.test.ts` proves the identical result. The *"no changes since last run"* hint is a server concern and is not covered. |

**Steps:** run the check twice without uploading anything.
**Expected:** permitted; identical result; officer sees *"No new documents since
the last check — result unchanged."*
**Verified part:** determinism. **Unverified part:** the hint needs a comparison
against the previous stored run.

### EX-16 · E-16 — Attempt to mark Decision-Ready while blocked 🟡

| | |
| --- | --- |
| Detected at (PRD) | Server (409) |
| Block | 🔴 |
| Maps to | PR-11, PC-03, PC-04, H7 |
| Automated cover | ✅ `automated/gate-enforcement.test.ts` — the engine refuses to report `DECISION_READY` while a required item is Missing or Expired, across an exhaustive sweep of every product and document state. The 409 response is not built. |

**Steps:** with the SC-05 file (1 Missing, 1 Expired), force the decision-ready
transition by editing client state or calling the endpoint directly.
**Expected:** **409** with *"Cannot mark decision-ready: 1 Missing, 1 Expired."*
**Verified part:** the gate logic is server-authoritative *in the engine* and
cannot be talked out of blocking — including by acknowledging warnings, which is
asserted explicitly. **Unverified part:** no HTTP surface exists to bypass or to
enforce.

### EX-17 · E-17 — Dashboard reads a stale status 🟡

| | |
| --- | --- |
| Detected at (PRD) | Server |
| Block | 🟢 |
| Maps to | TRD §7.1, PR-18 |
| Automated cover | ✅ `resolveOverallStatus` is exported and tested; `automated/gate-enforcement.test.ts` › *"Gate integrity"* asserts the status is recomputed from the published counts rather than trusted from a caller. No dashboard exists. |

**Steps:** edit `applications.status` directly, then load the dashboard.
**Expected:** the dashboard shows the status **derived from the latest persisted
check run**; the direct edit has no effect.

### EX-18 · E-18 — Expected decision date already in the past 🟡

| | |
| --- | --- |
| Detected at (PRD) | Engine (run normally) + client (banner) |
| Block | 🟡 |
| Maps to | §10.1 |
| Automated cover | ✅ `02_source/.../engine.test.ts` › *"Decision date in the past"*; ✅ `automated/invalid-metadata.test.ts` › *"E-18"*. The banner is not built. |

**Steps:** set a submission date of `2026-03-02` with an expected decision date
of `2026-01-15` and run the check.
**Expected:** runs normally; the banner reads *"Expected decision date
(2026-01-15) is in the past. Review the submission date or SLA."*
**Known limitation found:** the engine returns no machine-readable
"these dates are inconsistent" signal, so a future client has nothing to key the
banner off except re-deriving the comparison itself. Also note the freshness
items do **not** all go Expired as PRD predicts: a document issued *before* the
past decision date does expire as expected, but one issued *after* it has a
negative age and reads as valid (the DEF-07 mechanism). Both halves are asserted
in `automated/invalid-metadata.test.ts` › *"E-18"*.

---

## Group 3 — Data integrity and input trust

### EX-19 · E-19 — Officer enters a wrong but plausible date 🟡

| | |
| --- | --- |
| Detected at (PRD) | **Undetectable by the system** |
| Block | 🟡 |
| Maps to | PC-20, H2, PRD §5.3 |
| Automated cover | ✅ `automated/golden-wording.test.ts` pins the provenance string on every evaluated item and its absence on unevaluated ones. Displaying it is PC-20's method `E` and is not built. |

**Steps:** upload a bank statement and enter `2026-03-01` when the document says
`2026-02-01`. Run the check.
**Expected:** the item shows Present-Valid — the system cannot know better — and
carries the marker **`document dates entered by officer at upload`** so the
report never implies the date was read from the document.
**Note.** PRD calls this *"the MVP's principal accuracy risk"*. The mitigation is
labelling, not detection, and the label is verified at the source. Whether a UI
renders it is untestable today.

### EX-20 · E-20 — Rule version saved without running a preview 🟡

| | |
| --- | --- |
| Detected at (PRD) | Server |
| Block | 🟡 |
| Maps to | PC-22, PR-20 |
| Automated cover | ✅ `automated/rule-config-gate.test.ts` › *"E-20"* — demonstrates the schema cannot enforce version sequencing, and that an edit produces a new version rather than mutating the published one. The confirmation dialog and audit record are not built. |

**Steps:** save version 4 of `personal_salaried` without previewing.
**Expected:** permitted; the audit log records that no preview was run; a dialog
names the count of seeded applications affected — *"Save version 4? This affects
future checks on all Personal Loan — Salaried files."*
**Known limitation found:** `RuleSetSchema` accepts a version **lower** than one
already published, because a schema sees one record at a time. Sequencing must be
enforced against stored history in the API layer, which does not exist.

### EX-21 · E-21 — Historical check run cannot be replayed 🟡

| | |
| --- | --- |
| Detected at (PRD) | Audit review |
| Block | 🔴 (design constraint) |
| Maps to | PC-30, NFR-05, TRD §7.4 |
| Automated cover | ✅ `automated/replay-determinism.test.ts` — 15 tests: JSON round-trip replay is byte-identical, stable across repeats, independent of input ordering, independent of the ambient clock and of `Math.random`, and non-mutating. PC-29's static check finds zero forbidden constructs in the engine and core sources. |

**Steps:** take a stored run's inputs plus its rule version and re-evaluate.
**Expected:** identical result.
**Verified part:** the property a store would depend on. `evaluate` is provably a
pure function of its three arguments, so replay is bookkeeping.
**Known limitation found:** `CheckResult` carries **no engine version**. E-21
requires every run to store the engine version; today the caller must pair
`ENGINE_VERSION` with the result itself, and nothing enforces that pairing. A run
stored under engine `0.1.0` and replayed under `0.2.0` would silently produce a
different result with no way to detect it after the fact.

### EX-22 · E-22 — Concurrent check runs on the same application 🔴

| | |
| --- | --- |
| Detected at (PRD) | Server |
| Block | 🟢 |
| Automated cover | None |

**Steps:** fire two checks at the same application simultaneously.
**Expected:** both execute as separate immutable rows; the latest by `run_at`
governs status; no locking.
**Why blocked:** no `run_at`, no rows, no server. The engine's purity makes the
"both may execute" part safe by construction, but that is an inference, not a
test.

---

## Group 4 — Export, mobile, and access

### EX-23 · E-23 — CSV formula injection 🔴

| | |
| --- | --- |
| Detected at (PRD) | Export generator |
| Block | 🟢 |
| Maps to | PC-16, TRD SEC-06 |
| Automated cover | None |

**Steps:** seed a borrower name beginning `=` and export the fix pack as CSV.
**Expected:** the cell is apostrophe-prefixed; opening the CSV in a spreadsheet
does not execute a formula.
**Why blocked:** no export generator (TRD §7.5, WP5). PC-16's method is `U`, so
this becomes a unit test the moment the generator exists — it is the cheapest
blocked criterion in the set.

### EX-24 · E-24 — Mobile capture while offline 🔴

| | |
| --- | --- |
| Detected at (PRD) | Client |
| Block | 🔴 (writes) |
| Maps to | TRD §6.2, PC-39 |
| Automated cover | None |

**Steps:** open the mobile app, disable the network, attempt a document capture.
**Expected:** submission blocked with *"You're offline. Document capture needs a
connection to submit."*; the last-fetched report stays readable behind a stale
banner. Offline writes are out of scope.
**Why blocked:** no mobile app. TRD §6 is entirely unbuilt (no Expo project).

---

## Deliberately unhandled in MVP

PRD §8.6 records these so their absence is a decision, not an oversight. They are
**not** defects and have no scenarios: concurrent multi-officer edit conflicts
beyond idempotency keys · partial-upload resume · virus scanning beyond MIME
sniffing · rule version rollback or deletion (versions are immutable, never
removed) · borrower-side authentication.
