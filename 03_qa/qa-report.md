# ReadyFile QA report

**Version:** 1.0 · **Date:** 2026-11-21 · **Author:** QA (automated)
**Build under test:** commit `a3727e0` *"Implement the deterministic completeness engine and reconcile the specs"*, plus the uncommitted `03_qa/` suite and the `01_documents/TRD.md` citation fixes.
**Governing documents:** BRD v1.2, PRD v1.3, TRD v1.2

> Every number in this report was produced by a command run on the date above and
> is reproducible with `npm run verify` from `02_source/`. Nothing here is
> estimated, projected or carried over from an earlier run.

---

## 1. Verdict

**The release gate is not met, and cannot be met in the current state of the
repository.**

PRD §17 requires *"PC-01 … PC-47 all pass"* before the MVP ships. Of those 47
criteria, **8 pass, 12 are partially verified and 27 are blocked** because the
layer they name does not exist. Two stretch criteria (PC-48, PC-49) are also
blocked.

What *is* true: the completeness engine — the piece of ReadyFile that decides
whether a loan file is decision-ready — is implemented, is deterministic, and is
covered by **214 passing automated tests with zero failures and zero type
errors**. Eight defects were found during QA. Three are open, and one of them
(**DEF-07**) defeats the decision-ready gate outright.

The honest one-line summary: **the brain works and is well tested; the body does
not exist yet.**

---

## 2. Measured results

### 2.1 Test execution

| Suite | Location | Tests | Suites | Pass | Fail | Duration |
| --- | --- | --- | --- | --- | --- | --- |
| Engine unit matrix (TRD §15.1) | `02_source/packages/rules-engine/test/engine.test.ts` | 65 | 25 | 65 | 0 | 192 ms |
| QA acceptance suite | `03_qa/automated/*.test.ts` (9 files) | 149 | 45 | 149 | 0 | 666 ms |
| **Combined** | — | **214** | **70** | **214** | **0** | **~0.9 s** |
| API integration (`I`) | not built | 0 | 0 | — | — | — |
| E2E / Playwright (`E`) | not built | 0 | 0 | — | — | — |
| Manual rehearsal (`M`) | `03_qa/scenarios/` | 56 written | — | **0 executed** | — | — |

### 2.2 Static checks

| Check | Command | Result |
| --- | --- | --- |
| Typecheck, implementation | `npx tsc --noEmit -p tsconfig.json` | exit 0, no diagnostics |
| Typecheck, QA suite | `npx tsc --noEmit -p ../03_qa/tsconfig.json` | exit 0, no diagnostics |
| Dependency audit, all | `npm audit` | **0 vulnerabilities** |
| Dependency audit, production only | `npm audit --omit=dev` | **0 vulnerabilities** |
| Lint | — | **not configured** (see KL-07) |
| Coverage | — | **not measured** (see KL-08) |
| CI | — | **not present** (see KL-09) |

Both TypeScript projects compile under `strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes` and `erasableSyntaxOnly`.

### 2.3 Environment

| Item | Value |
| --- | --- |
| Node.js | v23.11.0 (`/opt/homebrew/bin/node`) |
| npm | 10.9.2 |
| Platform | darwin 27.0.0, arm64 |
| Test runner | Node built-in (`node --import tsx --test`) |
| Runtime dependencies | `zod` (core), `@readyfile/core` (rules-engine) — nothing else |

### 2.4 Performance

PRD §17 assigns two latency criteria. Both are measured **engine-only**; the
HTTP, database and serialization portions do not exist.

| Measurement | Setup | Result | Budget |
| --- | --- | --- | --- |
| PC-36 — check latency, 20 documents | 20 documents × 9 home-loan rules, 50 sequential runs after 200 warm-ups | median **0.0133 ms**, p95 **0.0274 ms**, max 0.4982 ms | p95 < 500 ms → **~18,000× inside** |
| PC-27 — rule edit then re-check | salaried file, 6 documents, edit-plus-rerun | **0.0153 ms** | < 2 minutes → the engine is ~7.8 million× inside; the human edit and page reload are the whole budget |
| PC-37 — same, on a cloud instance | — | **not measured** | no deployment exists |

Supporting runs from the same harness:

| Scenario | median | p95 | max |
| --- | --- | --- | --- |
| Salaried, 4 documents | 0.0073 ms | 0.0132 ms | 0.0735 ms |
| Salaried, 6 documents | 0.0060 ms | 0.0100 ms | 0.1923 ms |
| Salaried, sandbox re-run | 0.0071 ms | 0.0088 ms | 0.0324 ms |
| Home loan, 9 rules | 0.0076 ms | 0.0091 ms | 0.0279 ms |

Microsecond-scale figures jitter between runs; the order of magnitude does not.
`rule-config-gate.test.ts` asserts a 100 ms bound — roughly 14,000× the measured
value — so it fails on a real regression rather than on a slow machine.

### 2.5 Inventory

| Area | Files | Lines |
| --- | --- | --- |
| `02_source/packages/core/src` | 6 | 361 |
| `02_source/packages/rules-engine/src` | 8 | 785 |
| `02_source/packages/rules-engine/test` | 1 | 1,247 |
| **`02_source` total TypeScript** | **15** | **2,393** |
| `03_qa/automated` (9 test files + `fixtures.ts`) | 10 | 2,988 |
| `03_qa` plan, traceability and scenarios (Markdown) | 6 | 1,454 |

The two summary documents (`README.md`, this report) are excluded from the
Markdown count so that the figure does not change as they are written.

No file bytes are created anywhere in the suite. The engine consumes
`DocumentMeta` — id, type, dates, upload timestamp, version — so no test needs a
real document, and none exists.

---

## 3. Requirement coverage

Full per-criterion evidence, including the test file and suite name behind every
status, is in [`traceability.md`](traceability.md). Summary:

### 3.1 Acceptance criteria (PRD §17)

| Status | Count | Note |
| --- | --- | --- |
| ✅ Pass | 8 | PC-03, PC-06, PC-07, PC-08, PC-09, PC-19, PC-28, PC-29 |
| 🟡 Partial | 12 | The `U`/`G` half is verified; the `I`/`E`/`M` half names an unbuilt layer |
| 🔴 Blocked | 27 | No layer named in the criterion's method exists |
| ⚪ Stretch, blocked | 2 | PC-48 (PDF export), PC-49 (business-day SLA) |

PC-10a — hard-expiry equality semantics — was **added by this QA phase**; it is
not one of PRD's 47 and it passes.

### 3.2 Functional requirements (PRD §9)

| Priority | Done | Partial | Not started | Total |
| --- | --- | --- | --- | --- |
| Must | **7** | 4 | 5 | 16 |
| Should | 1 | 2 | 3 | 6 |

**7 of 16 Must-haves are done** (PR-05…PR-10, PR-12). Every one of the seven is
an engine behaviour. Every one of the five not-started Must-haves (PR-01, PR-03,
PR-04, PR-13, PR-22) needs the API, the database or the fix-pack generator.

### 3.3 Non-functional requirements (PRD §14)

| Status | IDs |
| --- | --- |
| ✅ Pass (2) | NFR-02 determinism, NFR-06 synthetic-data-only |
| 🟡 Partial (2) | NFR-01 performance (engine only), NFR-04 configurability (see KL-01, KL-02) |
| 🔴 Blocked (5) | NFR-03 usability, NFR-05 auditability, NFR-07 portability, NFR-08 security baseline, NFR-09 accessibility |

### 3.4 Exceptions (PRD §8.6)

Of E-01 … E-24: **2 fully verified** (E-12, E-13 — the only two PRD assigns to
the engine), **11 partially verified**, **11 blocked**. 22 of the 24 cannot be
exercised as written because their detection point is the upload path, the API,
the UI or the database.

### 3.5 TRD §15.1 unit matrix

All **16** named rows have a `describe` block titled with the row name. Five
genuine rows were added during the build (*Optional absent*, *Required date
null*, *Both bases configured*, *Full document tie*, *Determinism under
reordering*), plus three supporting suites.

### 3.6 Handoffs (PRD §5.3)

H1–H10: **0 complete, 3 partial** (H3 report content, H4 re-check loop, H7 the
gate), 1 out of band by design (H1), 6 blocked. **H2 — Loan Officer → ReadyFile —
is the handoff PRD itself calls the single largest accuracy risk, and it is the
one DEF-07 lands on.**

---

## 4. What is not built, and therefore not tested

Stated plainly, so that no passing test count is read as product readiness:

- **Fastify API** — no HTTP surface at all. Every `I` criterion is blocked.
- **Prisma schema, migrations, database** — no persistence. Nothing is stored, so
  nothing can be replayed, audited or versioned.
- **Seed script (TRD §14.3)** — the 2 products, 6 applications and 4 demo users do
  not exist. The QA fixtures are an independent transcription of PRD §11, not the
  seeded data.
- **JWT auth, role→route authorization middleware, role table (AD-08)** — only the
  `Role` const object exists. All 20 access-control scenarios (AC-01…AC-20) are
  blocked.
- **Append-only `audit_events` and the audit middleware (AD-09)** — none of the 16
  event types can be emitted. All six compliance questions in TRD §12.2 are
  unanswerable.
- **Document upload, storage driver, MIME sniffing** — E-01…E-04, E-07, E-09,
  E-19 cannot be exercised.
- **Fix-pack generator and CSV/PDF export** — PR-13, PR-14, PC-11…PC-16, PC-48
  blocked. PC-16 is the cheapest of these: a pure function, testable the moment it
  exists.
- **Rule sandbox persistence and preview endpoint** — preview *semantics* are
  verified (the original rule set is provably unchanged), but nothing is stored or
  served.
- **React web app, React Native/Expo mobile app** — no UI. Every `E` criterion and
  all 12 demo-rehearsal scenarios are blocked; none was executed.
- **Docker Compose deployment** — PC-37, PC-46 blocked.

TRD §18 work packages WP3–WP8 are entirely unbuilt and WP1 is partial.

---

## 5. Defect register

Eight defects were found. **Every open defect is reproduced by a passing test.**
That is deliberate: a red test would be fixed or skipped under deadline pressure,
whereas a passing test that asserts the *wrong* behaviour documents it precisely
and fails loudly the moment someone fixes it correctly.

Severity: **Critical** = defeats a stated product guarantee · **Major** = wrong
result reaches a user · **Minor** = cosmetic or documentation.

| ID | Severity | Status | Component | One-line summary |
| --- | --- | --- | --- | --- |
| DEF-01 | Major | ✅ Fixed | rules-engine | An absent *optional* document returned MISSING instead of NOT_APPLICABLE |
| DEF-02 | Minor | ✅ Fixed | core | `ReasonCode.OPTIONAL_NOT_REQUIRED` was unreachable dead code (same root as DEF-01) |
| DEF-03 | — | ⚪ Not a defect | PRD | Warning-boundary ambiguity; resolved by PRD §10.7 (*"age == max_age ⇒ Expiring Soon, not Expired"*) |
| DEF-04 | Minor | ✅ Fixed | TRD | §15.1 *"Version supersede"* row was unreachable as written under freshness semantics; row clarified |
| DEF-05 | Minor | ✅ Fixed | rules-engine | `dateProvenance` wording was false for hard-expiry-only items |
| **DEF-06** | **Major** | 🔴 **Open** | PRD §11 rule matrix | A self-employed Home Loan applicant can never reach Decision-Ready |
| **DEF-07** | **Critical** | 🔴 **Open** | rules-engine + upload validation | A document dated *after* the decision date passes as valid and can carry the file to Decision-Ready |
| **DEF-08** | **Minor** | 🔴 **Open** | rules-engine wording | Two borrower-facing reason strings begin with a lowercase word |

### DEF-06 — self-employed Home Loan applicants are permanently blocked

**Severity:** Major · **Status:** Open · **Where:** PRD §11 product × document
matrix, transcribed into `03_qa/automated/fixtures.ts`
**Evidence:** `product-matrix.test.ts` › *DEF-06 — a self-employed Home Loan
applicant can never be Decision-Ready* (4 tests)

**Reproduction.** A self-employed home-loan applicant (`self_employed: true`,
`tenure_months: 60`, `loan_amount: 480000`) uploads every document they can
actually obtain — government ID, address proof, bank statement, credit bureau
report, property valuation, tax return, insurance certificate. All seven are
fresh and valid. Measured result:

| Field | Value |
| --- | --- |
| `HL-PSL-01` (payslips) status | **MISSING** |
| `overallStatus` | **INCOMPLETE** |
| `blockingCount` | 1 |
| `validRequiredCount` / `applicableRequiredCount` | 7 / 8 |
| `score` | **88 — capped, unreachable 100** |

**Root cause.** The matrix marks `tax_return` **Conditional** on
`self_employed == true` but marks `payslips` unconditionally **Required**. So for
any applicant exactly one of the two income-evidence documents is unobtainable,
and the file can never clear the gate. The engine is behaving correctly; the rule
data is wrong.

**Fix, demonstrated in the test.** Making `HL-PSL-01` conditional on
`self_employed == false` and re-evaluating the identical file yields
NOT_APPLICABLE, `blockingCount` 0, `score` 100, `DECISION_READY`. The patched rule
set passes `RuleSetSchema`. It is a **data change, not a code change** — which is
exactly the agility NFR-04 promises.

**Scope.** Does not affect the Salaried product (no tax-return rule) or the
Self-Employed product (no payslip rule); only Home Loan carries both rows. TRD
§14.3 calls Home Loan *stretch* and seeds only two products, which lowers the
**demo** severity. It does not lower the **correctness** severity: the matrix is
published as the product's rule source, and anyone seeding Home Loan ships a
product that can never approve a self-employed borrower.

**Not fixed silently, because** the fix changes published requirement data, and
PRD §11 is the business owner's document, not QA's to edit.

### DEF-07 — a future-dated document defeats the decision-ready gate

**Severity:** Critical · **Status:** Open · **Where:** `evaluate-item.ts`
freshness arithmetic and `select-document.ts` selection; upstream, PRD E-07's
upload validation
**Evidence:** `invalid-metadata.test.ts` › *DEF-07 — a document dated after the
decision date passes as valid* (6 tests)

**Reproduction.** Expected decision date `2026-03-07`. A bank statement is
uploaded with issue date `2026-04-01` — 25 days *after* the decision date, and
after the submission date. Every other document in the file is valid. Measured
result:

| Field | Value |
| --- | --- |
| `PS-BANK-01` status | **PRESENT_VALID** |
| `reasonCode` | `VALID` |
| `reasonText` | `Issued 2026-04-01; will be -25 days old on 2026-03-07, within the 30-day limit.` |
| `nextAction` | `No action needed.` |
| `blockingCount` / `warningCount` / `score` | 0 / 0 / **100** |
| `overallStatus` | **DECISION_READY** |

**Why it is Critical.** Three separate failures compound:

1. **The gate is bypassed.** PRD H7 and PR-11 exist to stop exactly this: an
   impossible document carries the file to Decision-Ready with no other defect
   present.
2. **It wins document selection.** PRD §10.2 selects the latest issue date. A
   future date is the latest, so a bogus upload *displaces genuine evidence* —
   the test proves a `2026-04-01` statement supersedes a valid `2026-03-05` one.
3. **The borrower-facing sentence is nonsense.** "-25 days old" is rendered to a
   human being.

**The engine cannot detect this.** E-07's trigger is *"issue date after the
submission date"*, and `evaluate()` never receives the submission date — only the
expected decision date. The test asserts `DEMO_SUBMISSION_DATE < futureIssueDate`
to record that the comparison E-07 requires is not available inside a check run at
all.

**E-07's override flag does not exist either.** E-07 requires the override to be
*"stored and surfaced on the report"*. `ItemResult` has exactly nine keys —
`dateProvenance, documentType, evaluatedDocumentId, nextAction, reasonCode,
reasonText, requirement, ruleId, status` — and neither `demoOverride` nor
`demo_override` is among them. A deliberate override is therefore
indistinguishable from a typo, even once the flag is added upstream. Note that TRD
§12.2 **already specifies** `demo_override` inside `DOCUMENT_UPLOAD.detail`, so the
audit design and the engine result disagree.

**Where to fix it is a spec decision, not a QA decision.** Three defensible
options: reject at upload (E-07 as written), clamp in the engine (treat
`issueDate > decisionDate` as a metadata error, same path as E-05/E-06), or both.
Only "both" closes the hole for data that arrives through any other path. This is
why DEF-07 is reported rather than patched.

**Related finding — PRD E-18's prediction only half-holds.** E-18 covers a
submission date after the expected decision date and predicts *"nearly all
freshness items will be Expired"*; TRD §15.1 repeats it. Under the implemented
engine that is true for documents issued **before** the past decision date — the
suite now proves both halves, with a 40-day-old statement at decision date
`2026-01-15` correctly returning EXPIRED. It is **false** for a document issued
*after* that past date: decision `2026-01-15` with issue date `2026-02-03` yields
**PRESENT_VALID**, because the age is negative. Same mechanism as DEF-07, reached
through an inconsistent SLA instead of a mistyped date. The file still comes back
INCOMPLETE in that case, but only because the other items are MISSING — the
future-dated document itself is accepted. There is also **no machine-readable
inconsistency signal** on `CheckResult` (see KL-06), so the UI banner E-18 asks
for has nothing to key off.

### DEF-08 — two borrower-facing strings start lowercase

**Severity:** Minor · **Status:** Open · **Where:**
`02_source/packages/rules-engine/src/messages.ts`
**Evidence:** `invalid-metadata.test.ts` › *DEF-08 — two borrower-facing strings
start with a lowercase word* (3 tests)

Of the eleven `reasonText` templates in `messages.ts`, ten begin with a capital
letter. Two — the issue-date-absent and expiry-date-absent reasons — begin with
the document label in lowercase:

> `bank statement was uploaded but no issue date was recorded, so validity cannot
> be verified.`
> `government photo ID was uploaded but no expiry date was recorded, so validity
> cannot be verified.`

The test asserts `text[0] === 'b'` and `'g'` respectively, then samples eight
other templates plus `CONDITION_NOT_MET` (`'N'`) and `CONDITION_ATTRIBUTE_MISSING`
(`'R'`) to prove they capitalize. These strings reach the borrower through the fix
pack, so casing is user-visible. One-line fix; left open because changing
user-facing copy during QA without a wording review would repeat the mistake
DEF-05 was.

### Fixed defects (DEF-01, DEF-02, DEF-04, DEF-05)

Closed during implementation and retained here for the record. DEF-01 and DEF-02
shared a root cause: an absent optional document took the MISSING path, which made
`OPTIONAL_NOT_REQUIRED` unreachable. `gate-enforcement.test.ts` now sweeps every
reachable reason code across 3 products × 7 document states and asserts the set of
codes actually produced, so a newly-dead code would fail the suite. DEF-04 and
DEF-05 were documentation and wording defects, both corrected in the source
documents and the engine respectively.

---

## 6. Known limitations

These are **not defects**. They are gaps between what the specification asks for
and what exists, recorded so nobody mistakes silence for correctness.

| ID | Limitation | Impact | Where it bites |
| --- | --- | --- | --- |
| **KL-01** | The tax-return `max_age_days` is not stated in PRD §11 or BRD §6.2. QA fixtures assume **365** from ANZ's 12-month tax-notice evidence | A rule value is in test code, not in the spec | `fixtures.ts`; NFR-04 configurability |
| **KL-02** | The insurance-certificate condition names no application attribute. QA fixtures assume `security_type == 'property'` | Same as KL-01 — an invented condition | `fixtures.ts`; Home Loan rule set |
| **KL-03** | `CheckResult` carries **no engine version** | A stored run cannot self-identify against E-21's replay requirement; a future engine change silently invalidates history | `replay-determinism.test.ts` asserts the absence; PC-30, E-21 |
| **KL-04** | zod **strips** unknown keys instead of rejecting them | An author typo (`warn_horizon_days`, or `max_age_days` at item level) is silently ignored and the default applied — the rule change appears to save and does nothing | `rule-config-gate.test.ts` proves both cases parse successfully. `RuleSetSchema.strict()` closes it in one line; not applied because it would reject forward-compatible payloads the API does not define yet |
| **KL-05** | Rule-version **sequencing** is unenforceable at schema level | E-20's "no publishing an older version" needs a store to compare against; today versions 1 and 5 both parse | `rule-config-gate.test.ts` › *E-20* |
| **KL-06** | No machine-readable **"dates inconsistent"** signal on `CheckResult` | E-18's UI banner has nothing to key off; a client would have to re-derive the comparison | `invalid-metadata.test.ts` › *E-18* |
| **KL-07** | **No lint rule** for PC-29 | PC-29 names a lint rule as one of its methods. A static test scans `src/` each run instead, so a new file is caught — but only when tests run, and there is no CI | `replay-determinism.test.ts` › *PC-29 — static check* |
| **KL-08** | **No coverage measurement** | "214 passing" says nothing about untested branches. Traceability is by criterion, not by line | Install `c8` when WP3 lands |
| **KL-09** | **No CI** | Nothing runs these tests automatically. A regression can be committed and pushed unseen | `npm run verify` is one command; a GitHub Action is a small task |
| **KL-10** | Only **2 of 3 products** are in the MVP seed (TRD §14.3 calls Home Loan *stretch*) | Lowers DEF-06's demo severity, not its correctness severity. QA fixtures build all three regardless | `fixtures.ts` |
| **KL-11** | **E-08 contradictory metadata is not surfaced** in the report | A document with both an impossible issue date and a passed hard expiry reports only the hard-expiry reason. The test asserts `reasonText.includes('issue date') === false` | `invalid-metadata.test.ts` › *E-08* |

**Also unbuilt, and named in TRD §14.3:** the CI check that every seeded record
carries a synthetic marker. No seed data and no CI, so no check.

---

## 7. Specification discrepancies found during QA

QA read the three documents against the code and against each other. These were
corrected in `01_documents/` and in the QA suite; they are listed because a
mis-citation in a test comment is how a wrong behaviour gets defended.

| Location | Was | Corrected to |
| --- | --- | --- |
| `01_documents/TRD.md:771` | *"PRD §7.1 defines Missing"* | PRD §8.5 |
| `01_documents/TRD.md:782` | *"§7.4 and PRD §10.4"* | §7.3 step 3 and PRD §10.4 |
| QA suite (15 occurrences) | product × document matrix cited as *"PRD §10.1"* | **PRD §11** — §10.1 is *Expected decision date* |
| `fixtures.ts` | warning horizon cited as *"PRD §10.4"*; SLA default as *"TRD §5.1"* | PRD §10.3; TRD §14.2 (`SLA_DEFAULT_DAYS=5`) and PRD §16 step 1 |
| `golden-wording.test.ts` header | claimed *"TRD §6.2 requires web and mobile to render these strings verbatim"* | **No such requirement exists.** TRD §6.2 is *Mobile technical requirements* and the word "verbatim" appears nowhere in TRD. Rewritten against PC-19 (method `G`), TRD §7.3 step 5 and TRD §9 |
| `env` name in QA docs | `MULTIPART_MAX_BYTES` | `MAX_UPLOAD_BYTES=10485760` (TRD §14.2) |
| PRD E-18 / TRD §15.1 prediction | *"freshness items EXPIRED"* when the decision date is in the past | **Half right.** True for documents issued before that date; false for documents issued after it, which read as valid. See DEF-07 |
| PRD PC-11 threshold | *"3 entries"* | Assumes a file with 2 Missing + 1 Expired; the seeded demo fixture has 1 + 1. Recorded in `scenarios/demo-rehearsal.md`, not changed |

The pattern worth naming: **three separate times during this build, spec content
was asserted from memory rather than verified from disk.** The rule now written
into `test-plan.md` §9 is that every citation in `03_qa/` is grepped against the
file before it is used.

---

## 8. Decisions needed before the next work package

Three items are blocked on a human decision, not on code.

### 8.1 DEF-07 — where are future-dated documents rejected?

Owner: business / product. Options in §5 above. Until this is decided, the
decision-ready gate has a hole that a single mistyped date opens.

### 8.2 OQ-1 — which products are demoed?

Owner: business / product. Still open from the requirements phase. It determines
whether DEF-06 is demo-relevant at all, and whether Home Loan gets seeded.

### 8.3 OQ-7 — employment verification letter window: 30 or 60 days?

Owner: credit policy. **This QA phase priced the question instead of arguing it.**
`evl-window-impact.test.ts` runs a short-tenure salaried file at six EVL ages at
the decision date under both windows:

| EVL age at decision (days) | 10 | 25 | 35 | 45 | 55 | 65 |
| --- | --- | --- | --- | --- | --- | --- |
| `max_age_days: 30` (as documented) | PRESENT_VALID | EXPIRING_SOON | EXPIRED | EXPIRED | EXPIRED | EXPIRED |
| `max_age_days: 60` (as recommended) | PRESENT_VALID | PRESENT_VALID | PRESENT_VALID | PRESENT_VALID | EXPIRING_SOON | EXPIRED |

Measured impact of moving 30 → 60:

- **4 of 6** sampled ages change the item's status.
- **3 ages** (35, 45, 55) move from blocking to non-blocking.
- **4 of 6** change the **file-level verdict**.
- At age 35 specifically: `score` **83 → 100**, `blockingCount` **1 → 0**,
  `validRequiredCount` 5 → 6, `overallStatus` **INCOMPLETE → DECISION_READY**.
- The borrower-facing next action at age 35 under the 30-day window is
  `Upload an employment verification letter issued on or after 2026-02-05.` — a
  document request the evidence says is unnecessary.
- **Not a blanket loosening:** at 65 days the letter is EXPIRED and still blocks
  under both windows.
- Every other item in the file is byte-identical between the two runs, and the
  rule-set version stays 1 — the change is data, not code.
- **The demo file is unaffected:** at tenure 36 months the EVL rule is
  NOT_APPLICABLE, so the 11-step demo story does not change either way.

The decision is a credit-policy trade-off, and it is now quantified rather than
asserted.

---

## 9. Recommendation

1. **Do not present the passing test count as product readiness.** 214 tests cover
   two packages. PRD §17's release gate is 8 of 47.
2. **Decide DEF-07 before building the upload path.** Fixing it after WP3 means
   touching validation, the engine and the audit payload together.
3. **Apply `RuleSetSchema.strict()` when the API lands** (KL-04). It is one line,
   and the test that documents the current behaviour will fail — which is the
   intended signal.
4. **Wire `npm run verify` into a GitHub Action** (KL-09). Cheapest risk reduction
   available today.
5. **Land WP1's remainder next** — Prisma schema, `audit_events`, seed script,
   Fastify skeleton, demo login, authZ and audit middleware. Per `test-plan.md` §8
   that unblocks PC-31…PC-35, PC-46, PC-47, all 20 access-control scenarios and
   five exceptions. **PC-16 and PC-31 are the two cheapest blocked criteria** in
   the whole matrix.
6. **Add `engineVersion` to `CheckResult`** (KL-03) before any run is persisted.
   Retrofitting identity onto stored history is not possible.
7. **Fix the PRD §11 Home Loan payslip row** (DEF-06) as a rule-data change with a
   version bump, using the patch already demonstrated in
   `product-matrix.test.ts`.

---

## 10. Reproducing this report

```
cd 02_source
npm run verify        # typecheck both projects, then run both suites
npm audit             # dependency vulnerabilities
npm audit --omit=dev
```

Performance figures come from ad-hoc harnesses run against the same fixtures; the
assertions that *guard* them live in `rule-config-gate.test.ts` (100 ms bound on
re-evaluation) and `replay-determinism.test.ts` (PC-29 static and behavioural
checks). The scenario documents in `scenarios/` are manual scripts and were **not
executed** — see `scenarios/README.md` for why.

## 11. Related files

- [`README.md`](README.md) — how `03_qa/` is organised
- [`test-plan.md`](test-plan.md) — scope, levels, tooling, entry/exit criteria, unblocking map
- [`traceability.md`](traceability.md) — PC-01…PC-49, PR-01…PR-22, NFR-01…NFR-09, exceptions, handoffs → test → status
- [`scenarios/`](scenarios/) — 56 manual scenarios across three sets
- [`automated/`](automated/) — the acceptance suite (149 tests)
