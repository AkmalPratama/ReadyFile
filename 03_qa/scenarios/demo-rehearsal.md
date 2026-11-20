# Scenario set S1 — Demo rehearsal

**Source:** PRD §16 *MVP Demo Story* (steps 1–11) plus TRD §12.1 *Demo script for access control*.
**Method key:** `M` — manual rehearsal checklist (PRD §17).
**Persona:** Loan officer, `officer@demo.local` (TRD §12.1).

This is the script a human runs on stage. Every scenario below names the exact
numbers the engine produces, so a rehearsal that shows a different number is a
defect, not a variant.

## Seeded fixture these scenarios assume

TRD §14.3 seeds an *"expired-at-decision (27-day-old statement, 5-day SLA)"*
application. The automated suite pins the same shape to concrete dates so the
expected values below are checkable:

| Field | Value |
| --- | --- |
| Product | Personal Loan — Salaried (`personal_salaried`) |
| Submission date | `2026-03-02` |
| Processing SLA | 5 calendar days |
| Expected decision date | `2026-03-07` |
| Borrower | Synthetic (NFR-06 — no real PII) |
| Attributes | `employment_type: salaried`, `self_employed: false`, `tenure_months: 36`, `loan_amount: 45000` |
| Rule version | `personal_salaried` v1, `warning_horizon_days: 7` |

Documents at step 2: government photo ID (expiry `2029-03-01`) · address proof
(issued `2026-02-20`) · payslips (issued `2026-02-23`) · bank statement (issued
`2026-02-03`, i.e. 27 days before submission). Credit bureau report: not
uploaded.

## Status legend

| Mark | Meaning |
| --- | --- |
| 🔵 AUTOMATED | Verified by a passing test in `03_qa/automated/` at the engine boundary. No manual execution needed to trust the *logic*. |
| 🟡 PARTIAL | Engine layer automated; the scenario as written needs UI, API, database or seeded data that **does not exist yet**, so it cannot be rehearsed end to end. |
| 🔴 BLOCKED | Cannot be executed at all. The required component is not built. |
| ⚪ OUT OF SCOPE | Deliberately excluded from MVP. |

**Nothing in this set has been manually executed.** There is no UI, no API and no
seeded database, so no scenario can be marked 🟢 PASS. The `Automated cover`
column states exactly which part *is* verified and by what.

---

## SC-01 — Officer opens a Salaried application

| | |
| --- | --- |
| PRD step | 1 |
| Maps to | PR-01, PR-02, PC-38, NFR-03 |
| Status | 🔴 BLOCKED — no web UI (TRD WP4), no API (WP3), no seeded applications (WP1) |
| Automated cover | Fixture shape only: `demoApplication()` in `automated/fixtures.ts` reproduces the documented dates and attributes. |

**Precondition:** logged in as `officer@demo.local`.

**Steps**
1. Open the dashboard.
2. Select the seeded Personal Loan — Salaried application.
3. Read the header.

**Expected**
- Expected decision date is displayed as **`2026-03-07`** and labelled as
  *submission date + 5 calendar days* (PRD §10.1 requires the calculation be
  labelled, not implied).
- The checklist for `personal_salaried` v1 loads with **6 items**: government
  photo ID, address proof, payslips, bank statement, credit bureau report, and
  employment verification letter.
- Tax returns, business registration, property valuation report and insurance
  certificate do **not** appear — PRD §11 marks them *Not applicable* to this
  product, which is different from an item evaluating to *Not Applicable*.
- Click count from dashboard to report is **≤ 8** (PC-38). Not measurable until
  the UI exists.

---

## SC-02 — Officer uploads four documents

| | |
| --- | --- |
| PRD step | 2 |
| Maps to | PR-03, PR-04, H2, E-05, E-06 |
| Status | 🔴 BLOCKED — no upload endpoint, no file storage driver, no MIME sniffing |
| Automated cover | None. Document metadata enters the automated suite as a hand-built fixture, which deliberately bypasses every validation in E-01…E-10. |

**Steps**
1. Upload a government photo ID; set expiry date `2029-03-01`.
2. Upload an address proof; set issue date `2026-02-20`.
3. Upload payslips; set issue date `2026-02-23`.
4. Upload a bank statement; set issue date `2026-02-03`.

**Expected**
- Each upload asks for a document type and the dates that type needs: issue date
  for freshness-based types, expiry date for hard-expiry types (PRD §8.4).
- Omitting the expiry date on the government photo ID is rejected with *"Expiry
  date is required for government photo ID."* (E-06).
- Omitting the issue date on the bank statement is rejected with *"Issue date is
  required for bank statements."* (E-05).
- All four save as version 1.

---

## SC-03 — Credit bureau report is missing

| | |
| --- | --- |
| PRD step | 3 |
| Maps to | PR-06, PC-01 |
| Status | 🟡 PARTIAL |
| Automated cover | ✅ `automated/demo-story.test.ts` › *"PRD §16 step 5"* — the item is `MISSING` with reason code `NO_DOCUMENT`. UI rendering is not covered. |

**Expected after running the check**
- Credit bureau report status: **Missing**.
- Reason text: **`No credit bureau report uploaded.`**
- Next action: **`Upload a credit bureau report issued within the last 30 days.`**
- Rule ID shown: **`PS-CBR-01`**.
- Provenance marker absent on this item — nothing was evaluated (PC-20 / E-19).

---

## SC-04 — The money moment: valid today, expired at the decision date

| | |
| --- | --- |
| PRD step | 4 |
| Maps to | PR-08, PC-06, PG-01, FR-15, differentiator #1 |
| Status | 🟡 PARTIAL |
| Automated cover | ✅ `automated/demo-story.test.ts` › *"PRD §16 step 4"* — age 27 at submission, 32 at decision, `EXPIRED`, and the exact next-action string. |

**Steps**
1. Run the completeness check.
2. Pause before revealing the bank statement row. *(PRD §16: "Rehearse the pause
   before revealing it — this single item is the entire differentiation
   argument.")*
3. Read the bank statement row aloud.

**Expected**
- Bank statement status: **Expired** — not Expiring Soon, not Present-Valid.
- Age at submission is **27 days**, inside the 30-day rule. Age at the expected
  decision date is **32 days**, outside it. Both numbers must be visible.
- Rule ID: **`PS-BANK-01`**. Reason code: **`FRESHNESS_AT_DECISION`**.
- Next action: **`Upload a bank statement issued on or after 2026-02-05.`**
- Provenance marker present: **`document dates entered by officer at upload`**
  (E-19, PC-20). This is the honesty marker — the date was typed, not read.

**Rehearsal note.** If the UI shows this item as anything other than Expired, the
decision-date forecast is not wired up and the demo has lost its only
differentiator. This is the single highest-priority scenario in the set.

---

## SC-05 — Banner shows Incomplete and blocks the gate

| | |
| --- | --- |
| PRD step | 6 (and 5) |
| Maps to | PR-10, PR-11, PC-03, H7, E-16 |
| Status | 🟡 PARTIAL |
| Automated cover | ✅ `automated/gate-enforcement.test.ts` › *"H7 / PR-11"* and › *"E-16"*; ✅ `automated/demo-story.test.ts` › *"PRD §16 step 6"*. Server-side 409 enforcement (E-16) is **not** covered — no API. |

**Expected**
- Banner: **Incomplete**.
- Score: **60** — 3 valid of 5 applicable required items (ID, address proof,
  payslips valid; bank statement expired; credit bureau report missing).
- Blocking count: **2**.
- Employment verification letter: **Not Applicable** — tenure is 36 months, so
  the `tenure_months < 12` condition is not met. It is excluded from the score
  denominator, which is why the denominator is 5 and not 6.
- The *Mark decision-ready* action is absent or disabled (TRD §12.1 rule 3: the
  UI hides it; the server remains the authority).
- Attempting it anyway returns **409** with *"Cannot mark decision-ready:
  1 Missing, 1 Expired."* — **not testable, no API**.

---

## SC-06 — Generate the borrower fix pack

| | |
| --- | --- |
| PRD step | 7 |
| Maps to | PR-13, PR-14, PC-11…PC-16, §7.2 |
| Status | 🔴 BLOCKED — fix-pack generator (TRD §7.5, WP5) and CSV export are not built |
| Automated cover | Indirect only: the golden suite pins the `next_action` strings the fix pack would be built from (`automated/golden-wording.test.ts`). |

**Expected**
- **Exactly one** pack containing **exactly two** entries for this file: bank
  statement (Expired) and credit bureau report (Missing). PC-11's threshold of
  3 entries assumes a 2-Missing + 1-Expired file; this fixture has 1 + 1.
- Employment verification letter (Not Applicable) never appears (PC-12).
- No Expiring Soon entries, because this file has none; with
  `include_warnings=true` any Expiring Soon item would appear (PC-13).
- Every entry carries document type, plain-language request, freshness guidance
  and reason — 4/4 fields (PC-14).
- CSV export is UTF-8 with a header row and one row per item (PC-15); cells
  beginning `=` `+` `-` `@` are apostrophe-prefixed (PC-16, E-23, TRD SEC-06).

---

## SC-07 — Officer uploads the replacements

| | |
| --- | --- |
| PRD step | 8 |
| Maps to | PR-15, PR-16, PC-42 |
| Status | 🔴 BLOCKED — no upload path, no document versioning in a database |
| Automated cover | ✅ Version selection is covered at the engine boundary: `automated/demo-story.test.ts` › *"PRD §16 steps 8–10"* asserts the item resolves to `doc-demo-bank-v2`. |

**Steps**
1. Upload a fresh bank statement, issue date `2026-03-05` (2 days before the
   decision date), as **version 2**.
2. Upload a credit bureau report, issue date `2026-03-05`.

**Expected**
- The superseded bank statement is **retained**, not overwritten (PR-16), and
  stays linked to the earlier check run.
- The checklist still shows one bank statement row.

---

## SC-08 — Rerun the check

| | |
| --- | --- |
| PRD step | 9 |
| Maps to | PR-05, PR-15, E-15, PC-10 |
| Status | 🟡 PARTIAL |
| Automated cover | ✅ `automated/demo-story.test.ts` › *"PRD §16 steps 8–10"*. The *"no changes since last run"* hint (E-15) is a server concern and is not covered. |

**Expected**
- A second check run is created as a separate immutable row (E-22, NFR-05).
- Bank statement now resolves to version 2: **Present-Valid**.
- Credit bureau report: **Present-Valid**.

---

## SC-09 — File becomes Decision-Ready and the timeline shows the improvement

| | |
| --- | --- |
| PRD step | 10 |
| Maps to | PR-11, PR-17, PC-04, PC-42, K6 |
| Status | 🟡 PARTIAL |
| Automated cover | ✅ Score and status transition are covered by `automated/demo-story.test.ts` and `automated/gate-enforcement.test.ts`. The **timeline view** is not built. |

**Expected**
- Banner: **Decision-Ready**.
- Score: **100**. Blocking count: **0**. Warning count: **0**.
- Because there are no warnings, no acknowledgment is needed (PRD §10.6).
- Timeline shows run 1 → Incomplete / 60 and run 2 → Decision-Ready / 100, each
  with its rule version and expected decision date (PR-17, E-21).

---

## SC-10 — Policy sandbox: bank statement max age 30 → 45

| | |
| --- | --- |
| PRD step | 11 |
| Maps to | PR-19, PR-20, PC-21…PC-27, PG-05, K5 |
| Status | 🔴 BLOCKED — no rule-config UI, no `rule_versions` table, no preview endpoint |
| Automated cover | ✅ `automated/rule-config-gate.test.ts` › *"Rule-change agility"* and › *"E-20"*; ✅ `automated/demo-story.test.ts` › *"PRD §16 step 11"*. |

**Steps**
1. Open the policy sandbox for `personal_salaried`.
2. Change `PS-BANK-01` `freshness.max_age_days` from **30** to **45**.
3. Preview the impact on seeded applications.
4. Save as a new version.

**Expected**
- Preview only: **0 historical rows modified** (PC-21).
- On the step-2 file, the bank statement flips **Expired → Present-Valid** (age
  32 is inside the new 45-day window, and outside the new 38–45 warning range).
  Score moves **60 → 80**. The file stays **Incomplete**, because the credit
  bureau report is still missing — the sandbox does not rescue a missing
  document.
- Saving produces **version 2**, marked active (+1, PC-22). Version 1 is
  unchanged and still readable (PC-24, NFR-05).
- A check run after save records rule version **2** (PC-23).
- Confirmation dialog names the count of seeded applications affected, and the
  audit log records whether a preview was run (E-20).
- **Zero code changes, zero redeploys** (PC-26).
- Timed rehearsal: edit → save → recheck in **under 2 minutes** (PC-27, K5).

**Measured at the engine layer.** Re-evaluating the seeded file under the changed
rule takes a median of **0.007 ms**; the edit-plus-rerun pair takes **0.017 ms**.
The remaining budget is entirely human and UI, and cannot be measured until WP5
exists.

---

## SC-11 — Sandbox preview must not rewrite history

| | |
| --- | --- |
| PRD step | 11 (negative case) |
| Maps to | PC-21, PC-24, NFR-05, BR-07 |
| Status | 🟡 PARTIAL |
| Automated cover | ✅ `automated/demo-story.test.ts` asserts the original rule set still reports version 1 and the original bank-statement status after the sandbox variant is evaluated; ✅ `automated/replay-determinism.test.ts` asserts `evaluate` does not mutate the rule set it is given. |

**Expected**
- Re-reading run 1 after the sandbox save returns a byte-identical result
  (PC-24).
- No preview run appears in the check-run history as if it were a real check.

---

## SC-12 — Access control demo (TRD §12.1)

| | |
| --- | --- |
| Source | TRD §12.1 *Demo script for access control* |
| Maps to | PC-33, PC-34, PC-35, SEC-03, SEC-04, AD-08 |
| Status | 🔴 BLOCKED — no auth, no JWT, no middleware, no audit trail |
| Automated cover | None. The `Role` enum exists in `@readyfile/core` and is the only built piece. |

**Steps** (TRD §12.1, "roughly 45 seconds")
1. Log in as `underwriter@demo.local`.
2. Show that upload, run-check and rule-save actions are absent.
3. Attempt `PUT /products/personal_salaried/rules` with the underwriter token.
4. Log in as `auditor@demo.local` and open the audit trail.

**Expected**
- Step 3 returns **403** (PC-34).
- The denial appears as an `AUTH_DENIED` audit event (TRD §12.1 rule 5) — "so a
  judge can see the control working rather than taking it on faith".
- An unauthenticated request to any non-public endpoint returns **401** (PC-33).
- Cross-application access returns **404**, not 403, to avoid leaking existence
  (PC-35, TRD §12.1 rule 2).

See `role-access-scenarios.md` for the full permission matrix as testable
scenarios.
