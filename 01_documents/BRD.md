# Business Requirements Document

## ReadyFile — Loan Document Completeness Checker (Hackathon MVP)

> **Know at intake. Decide on time.**

| Item | Detail |
| --- | --- |
| Document version | 1.2 (Markdown edition) |
| Date | 16 November 2026 (v1.1) · converted and extended 20 November 2026 |
| Domain | Financial Services — Retail & SME Lending Operations |
| Product owner | Loan Operations / Hackathon Team |
| Status | For review |
| Source | `ReadyFile_BRD.docx` v1.1, QMind notebook `ReadyFile` |

### About this edition

This is a faithful Markdown conversion of BRD v1.1 with **three gap-fill additions** requested during review. Sections sourced from the original are unmarked. New material is flagged:

> 🆕 **[GAP FILL]** — added 2026-11-20, not present in the original v1.1.

Gap fills in this document:

1. **§2.3 Pain Validation — Source Evidence** — the original §2.1 asserted five pain points with no citations, and §3.2 baselines were labelled *"assumed"*. Both are now anchored to external sources with confidence tiers.
2. **§3.2 Baseline KPI Register** — replaced assumed baselines with evidence-anchored values, and separated them from metrics ReadyFile must measure itself.
3. **§5.3 Scope Boundary Tests** — the original §5.1/§5.2 listed scope but gave no decision rule for borderline requests. Added an explicit in/out test and a scope-change log.

Two findings from the evidence review **contradict** the original document and are called out inline — see §2.3 and §6.2.

---

## 1. Executive Summary

Loan applications frequently stall in processing because required documents are missing, illegible, or expired by the time the file reaches an underwriter. Today this is discovered late — often days after submission — triggering rework loops with the borrower, repeated back-and-forth emails, and avoidable delays to approval and disbursement.

**ReadyFile** (the Loan Document Completeness Checker) is a lightweight tool that validates a loan application's document package **at intake**: it compares uploaded documents against a configurable checklist per loan product, verifies validity dates against freshness rules, and produces an instant completeness report with a clear list of gaps and expiry issues. The hackathon MVP demonstrates this end-to-end on a small set of loan products with a rules-driven engine and a simple dashboard.

**Expected outcome:** shift document defect detection from underwriting (day 3–5) to intake (minute 1), reducing rework cycles and shortening time-to-decision.

---

## 2. Background and Problem Statement

### 2.1 Current-state pain points

1. **Missing documents discovered late.** Loan officers manually compare received files against product checklists held in spreadsheets or email templates. Omissions are typically caught only when an underwriter picks up the file.
2. **Expired documents slip through.** Time-sensitive documents (e.g., bank statements, payslips, credit reports, valuations, insurance certificates) have freshness windows. A document valid at submission may expire before decision, forcing re-collection.
3. **Rework loops delay processing.** Each missing/expired item triggers a borrower request cycle averaging several days, inflating turnaround time (TAT) and hurting customer experience.
4. **No single visibility of file readiness.** There is no at-a-glance status showing whether a file is "decision-ready," so files queue that cannot progress.
5. **Inconsistent checklist application.** Different officers apply different standards; audit trails of what was checked and when are weak.

### 2.2 Business impact

- Longer time-to-decision and time-to-disbursement, risking customer drop-off to competitors.
- Higher operational cost per loan from manual chasing and re-keying.
- Compliance exposure when stale KYC or income evidence is used in a decision.
- Underwriter capacity wasted on incomplete files.

### 2.3 Pain Validation — Source Evidence

> 🆕 **[GAP FILL]** Added 2026-11-20. The original §2.1 presented all five pain points as unqualified assertions. This section maps each to external evidence.

**Why this matters:** the BRD is the document judges and business reviewers will challenge first. An unevidenced pain statement invites "how do you know?" A cited one converts the pitch from opinion into an observed industry pattern.

#### Evidence confidence tiers

| Tier | Definition | Weight |
| --- | --- | --- |
| **A — Primary policy** | Published credit policy of a real lender or regulator | High. Directly evidences that freshness windows are real, enforced constraints |
| **B — Vendor data** | Figures published by a lending-technology vendor | Medium. Directionally useful but self-interested; vendor benefits from the problem existing |
| **C — Trade press** | Industry blog or magazine with no named primary source | Low. Use for framing only, never as sole support for a number |

#### Pain-point validation

| # | Pain point (§2.1) | Supporting evidence | Tier | Confidence |
| --- | --- | --- | --- | --- |
| P1 | Missing documents discovered late | Commercial underwriting guides place document collection at **4–7 calendar days** of delay per file, and exception round-trips at **2–5 calendar days** lost — the largest single delay contributor ahead of spreading (1–2 days) and memo prep (3–5 hrs) | C | **High** — figure is specific and consistent with the described mechanism |
| P2 | Expired documents slip through | Real lenders publish hard document-age limits and measure them **at submission date**: AMP requires payslips "less than 60 days old at the date the loan was submitted" and loan statements "less than 30 days old from the date of application submission"; ANZ requires payslips "no older than 60 days" and ID bills "less than three months old" | **A** | **Very high** — primary policy documents |
| P3 | Rework loops delay processing | Blend reports **36% of borrowers say they had to provide the same document multiple times**, correlating with an **11-point NPS drop**; a further **9% considered their lender's document requests unreasonable**, correlating with a **70-point NPS drop** | B | **Medium-high** — vendor-sourced but specific and plausibly adverse to admit |
| P4 | No single visibility of file readiness | nCino describes institutions discovering bottlenecks only retrospectively via operational analytics — e.g. "underwriting is taking 16 days when similar institutions run it in 11" — implying readiness state is not visible in-flight | B | **Medium** — inferred from vendor framing, not a measured statistic |
| P5 | Inconsistent checklist application | Checklists exist as published lender policy (Tier A sources above), which confirms a *standard* exists to be inconsistent against; no source quantifies officer-level variance | A (existence only) | **Low on magnitude** — the variance claim is unevidenced. See open item OQ-B1 |

#### Abandonment and competitive risk

The §2.2 claim that delay risks customer drop-off is supported at **Tier C**: trade press reports ~68% of online loan applications are abandoned and 48% of consumers experiencing digital friction take their business elsewhere. **Neither figure names a primary survey.** Use for framing; do not put the number on a slide as fact.

#### Counter-evidence — record honestly

Two pieces of evidence cut against ReadyFile's positioning. Both should be surfaced in the pitch rather than discovered by a judge.

| # | Counter-evidence | Source | Rebuttal position |
| --- | --- | --- | --- |
| CE-1 | Blend markets Autopilot as delivering "up to **50% fewer unnecessary follow-ups compared to a rules engine**" — i.e. an incumbent explicitly positions *against* deterministic rules | Tier B | Accept the framing, narrow the claim. ReadyFile is not competing on follow-up minimisation; it competes on **explainability and auditability**. A rules engine's defect is over-requesting; its virtue is that every result is traceable to a policy line, which is what Compliance and Audit need (BRD §4). AI extraction and deterministic rules are complements, not substitutes — see §11 roadmap item 1 |
| CE-2 | Published lender policy measures document age **at submission date**, not at a future decision date. ReadyFile's BR-02 (freshness at *expected decision date*) is therefore **stricter than observed market practice** | Tier A | This is a deliberate product position, not a market standard, and must be labelled as such. It is defensible: it catches documents that go stale mid-process, which is precisely pain point P2. But the BRD must not claim lenders already do this. See §6.2 note and PRD §7.1 |

#### Evidence register

| Ref | Source | Type | Date | URL |
| --- | --- | --- | --- | --- |
| E1 | AMP Australia — Credit Policies | A | accessed 2026-11-20 | https://distributor.amp.com.au/policies |
| E2 | ANZ — Home loan application checklist | A | accessed 2026-11-20 | https://www.anz.com.au/personal/home-loans/get-started/checklist/ |
| E3 | Macquarie — Residential Home Loans Credit Guidelines | A | accessed 2026-11-20 | https://www.macquarie.com.au/assets/bfs/documents/broker/mortgages/macquarie_broker-credit-guidelines.pdf |
| E4 | IITL — Credit Policy Manual | A | 2023-11-08 | https://iitlgroup.com/files/policies/Credit%20Policy%2008-11-2023.pdf |
| E5 | EBA — Guidelines on loan origination and monitoring (EBA/GL/2020/06) | A | 2020-05-29 | https://www.eba.europa.eu/sites/default/files/document_library/Publications/Guidelines/2020/Guidelines%20on%20loan%20origination%20and%20monitoring/884283/EBA%20GL%202020%2006%20Final%20Report%20on%20GL%20on%20loan%20origination%20and%20monitoring.pdf |
| E6 | Blend — *From Upload to Underwriting in 15 Seconds: Autopilot* | B | 2026-03-03 | https://blend.com/blog/blend-momentum/blend-autopilot-automated-underwriting-document-review/ |
| E7 | nCino — *Find Lending Workflow Bottlenecks with Operational Analytics* | B | 2026-06-05 | https://www.ncino.com/blog/how-operational-analytics-pinpoint-bottlenecks-lending-workflow |
| E8 | aloan.ai — *How to Reduce Turnaround Time in Commercial Loan Underwriting* | C | 2026-05-19 | https://aloan.ai/guides/reduce-turnaround-time-commercial-loan-underwriting |
| E9 | Visionet — *Missing documents in mortgage processing* | C | 2026-05-18 | https://www.visionet.com/blog/missing-documents-delay-mortgage-processing-increase-operational-costs |
| E10 | The MortgagePoint — *How to Combat Loan Application Abandonment* | C | 2025-08-11 | https://themortgagepoint.com/2025-08-11/how-to-combat-loan-application-abandonment/ |
| E11 | Finanta — *Commercial Lending Trends 2026* | C | accessed 2026-11-20 | https://www.finanta.io/commercial-lending-trends/ |

> **Note on E9:** retrieved in full and contains **no** quantitative data — qualitative only ("stalled files", "increased operational costs"). It is retained as framing support for P1/P3 but must not be cited for any number.

> **Note on a PRD citation defect:** PRD §3 cites an Encompass Developer Connect URL at `developer.icesmorgagetechnology.com`. That host is a corruption of *ICE Mortgage Technology* and does not resolve to a legitimate Encompass reference. The citation should be re-verified against `developer.icemortgagetechnology.com` or dropped. Tracked as OQ-B2.

#### Evidence gaps to close

| ID | Gap | How to close | Blocks? |
| --- | --- | --- | --- |
| OQ-B1 | No quantified evidence of officer-to-officer checklist variance (P5) | Shadow 2–3 intake officers, or have an FSI mentor confirm from experience; record as a qualitative attestation | No — but do not state a number without it |
| OQ-B2 | Encompass citation unverifiable | Re-verify or remove from PRD §3 | No |
| OQ-B3 | No internal baseline data — ReadyFile has no access to a live lender's pipeline | Explicitly accept this: all baselines are **external benchmarks**, and the MVP measures only its own detection performance on synthetic seeded cases. Stated in §3.2 | No — but the limitation must be disclosed on stage |

---

## 3. Goals, Objectives, and Success Metrics

### 3.1 Business goals

| # | Goal |
| --- | --- |
| G1 | Detect 100% of missing required documents at intake, before underwriter assignment |
| G2 | Detect expired and soon-to-expire documents automatically using product-level freshness rules |
| G3 | Give loan officers and borrowers an actionable gap list in one place |
| G4 | Provide a verifiable "decision-ready" gate for files entering underwriting |

### 3.2 Baseline KPI Register

> 🆕 **[GAP FILL]** Rewritten 2026-11-20. The original table's baseline column was headed *"Baseline (assumed)"* with no provenance. That has been split into two registers, because the MVP is being asked to do two different things and conflating them makes the targets unfalsifiable.

#### Register A — External benchmark baselines (context, not measured by ReadyFile)

These establish that the pain is real. ReadyFile does **not** measure them and must not claim to improve them within the hackathon.

| KPI | Baseline | Basis | Tier | Ref |
| --- | --- | --- | --- | --- |
| Document-collection delay per file | **4–7 calendar days** | Commercial underwriting guide | C | E8 |
| Exception round-trip delay | **2–5 calendar days** lost per cycle | Commercial underwriting guide | C | E8 |
| End-to-end standard commercial file cycle time | **1–2 weeks** manual → **2–3 business days** optimised | Commercial underwriting guide | C | E8 |
| Borrowers re-supplying the same document | **36%** | Vendor published data | B | E6 |
| Borrowers finding document requests unreasonable | **9%** | Vendor published data | B | E6 |
| Enforced document age limits | Bank/loan statements **30 days**; payslips **60 days**; ID/address bills **~90 days** | Primary lender credit policy | **A** | E1, E2, E3 |

#### Register B — MVP demo targets (measured by ReadyFile on synthetic seeded data)

These are the only numbers the MVP is accountable for.

| KPI | Definition | Baseline (current manual process) | MVP target | Measured how |
| --- | --- | --- | --- | --- |
| **K1 — Defect detection latency** | Upload-complete → report displayed | 2–5 days (defect found at underwriting) | **< 60 seconds**; engine budget < 5 s for ≤ 20 docs | Timer in demo; load test script (TRD §13) |
| **K2 — Seeded defect coverage** | Seeded missing/expired cases correctly flagged | Manual, inconsistent | **≥ 95%** | Golden-file unit matrix (TRD §15.1) |
| **K3 — Explanation completeness** | Blocked items showing reason + rule ID + next action | None (free-text email) | **100%** | Asserted in API integration tests |
| **K4 — Rework consolidation** | Distinct borrower requests per incomplete file | Fragmented, one per defect | **1** consolidated fix pack | Counted in demo script step 7 |
| **K5 — Rule-change agility** | Edit a freshness rule → save → recheck | Code/deployment change | **< 2 minutes**, zero code changes | Sandbox E2E test |
| **K6 — Recheck conversion** | Applications moving Incomplete → Decision-Ready after replacement docs | Not tracked | **Demonstrated in ≥ 1 scenario** | Seeded two-run history case (TRD §14.3) |
| **K7 — Determinism** | Same inputs + same rule version → identical result | n/a | **100%** byte-identical | Golden-file tests, CI |

#### Post-MVP business KPIs (out of scope for the hackathon; recorded so the roadmap has targets)

Reduction in document-related rework cycles · reduction in time-to-decision · fewer borrower follow-up requests per file · percentage of files entering underwriting already decision-ready. Each requires a live lender pipeline to measure — see OQ-B3.

### 3.3 Out-of-scope goals (post-MVP)

Full OCR-based content verification, fraud/authenticity detection, integration with live core banking/LOS systems, and automated borrower notifications are deliberately excluded from the hackathon build (see §5.2).

---

## 4. Stakeholders and User Personas

| Persona | Role | Primary need |
| --- | --- | --- |
| Loan Officer / Intake Agent | Creates application, uploads documents | Instant checklist of what is missing or expired; clear next actions |
| Underwriter / Credit Analyst | Assesses decision-ready files | Confidence the package is complete and current before starting review |
| Operations Manager | Monitors pipeline | Dashboard of file readiness and top defect reasons |
| Borrower (indirect) | Supplies documents | Fewer, clearer, consolidated requests instead of repeated chases |
| Compliance / Audit (indirect) | Reviews process | Logged evidence of what was checked, when, and against which rules |

---

## 5. Scope

### 5.1 In scope (MVP)

1. **Application intake (lightweight):** create a loan application with borrower name, loan product, amount, and submission date.
2. **Document upload:** attach files (PDF, JPG, PNG) to an application, tagged with a document type from the product checklist.
3. **Configurable checklist rules:** per loan product, a rules file/table defining required document types, conditional requirements, and freshness windows. Seeded for 2–3 products (Personal Loan — Salaried, Personal Loan — Self-Employed, Home Loan).
4. **Completeness engine:** compare uploaded documents against the checklist; classify each item as Present–Valid, Missing, Expired, Expiring Soon, or Not Applicable.
5. **Expiry/freshness validation:** use document issue/expiry dates (captured at upload in MVP) against freshness rules and the application's expected decision date.
6. **Completeness report and dashboard:** per-application status with gap list, overall completeness score, and decision-ready flag; pipeline view across applications.
7. **Re-check loop:** upload replacement/additional documents and re-run the check; status updates immediately.
8. **Audit log:** record every check run with timestamp, rule-set version, and results.

### 5.2 Out of scope (MVP)

- OCR / AI extraction of dates and fields from document images (dates are manually entered at upload in MVP; flagged as the top post-MVP enhancement).
- Document authenticity, tamper, or fraud checks.
- Integration with LOS/core banking, credit bureaus, or e-signature providers.
- Automated email/SMS reminders to borrowers (gap list is shown to the loan officer, who acts on it).
- User authentication/role management beyond a simple demo login; production-grade security hardening.
- Multi-currency, multi-jurisdiction regulatory rule packs.

### 5.3 Scope Boundary Tests

> 🆕 **[GAP FILL]** Added 2026-11-20. §5.1/§5.2 enumerate scope but give no rule for adjudicating a request that is not obviously on either list — which is how hackathon scope creep actually happens.

Apply these four tests in order to any proposed addition. **All four must pass** for the item to enter MVP scope.

| Test | Question | Fails if |
| --- | --- | --- |
| **T1 — Demo-spine** | Does the item appear in the §10 acceptance demo flow? | It is polish on a path judges never see |
| **T2 — No new external dependency** | Can it be built with the existing stack and synthetic data? | It needs a live API, real PII, credentials, or a third-party service |
| **T3 — Determinism preserved** | Does it keep NFR-05 (same inputs ⇒ same result)? | It introduces a clock, network call, or model inference inside the engine |
| **T4 — Time-box** | Is it estimable at ≤ half a work package (TRD §18)? | It would displace an **M**-priority FR |

#### Adjudicated borderline items

| Item | Verdict | Reasoning |
| --- | --- | --- |
| CSV export of fix pack | **In (S)** | T1–T4 pass; PRD lists it as should-ship |
| PDF export of fix pack | **Out — stretch** | T4 fails; only after WP1–8 demo passes |
| Business-day SLA calculation | **Out — stretch** | T4 fails; calendar days suffice for MVP, interface already isolates it (TRD AD-07) |
| Canned OCR extraction demo | **Out — stretch** | T3 fails if wired into the engine. Permitted **only** as a separate, clearly-labelled side demo that never feeds a real check run |
| Warning acknowledgment workflow | **In (simple form)** | Required for the Decision-Ready gate to be honest — FR-08 allows warnings only with acknowledgment |
| Maker-checker rule approval | **Out** | T4 fails badly; explicitly a PRD non-goal |
| Borrower-facing accounts | **Out** | T2 fails — needs identity, auth, and comms. Mobile "borrower view" is a demo-mode read-only screen only |
| Push notifications / offline mobile writes | **Out** | T2, T4 fail; TRD §6.2 marks both post-MVP |

#### Scope-change log

| Date | Change | Requested by | Tests | Decision |
| --- | --- | --- | --- | --- |
| 2026-11-20 | Baseline KPIs split into external-benchmark vs MVP-measured registers | Review | — | Accepted; no scope impact |
| 2026-11-20 | Employment verification letter freshness: 30 → 60 days proposed | Evidence review (§6.2) | T1–T4 pass | **Pending business sign-off** — see §6.2 |
| | | | | *(append new rows below)* |

---

## 6. Business Requirements

Priority key: **M** = Must have for demo · **S** = Should have if time permits · **C** = Could have (stretch).

### 6.1 Functional requirements

| ID | Requirement | Description | Priority |
| --- | --- | --- | --- |
| FR-01 | Create application | Officer creates an application selecting a loan product; system loads that product's checklist and freshness rules. | M |
| FR-02 | Product checklist configuration | Checklist per product defines: document type, required/conditional/optional flag, condition (e.g. "required if self-employed"), freshness window (max age in days), and hard-expiry flag. Editable via config file or admin screen; no code change needed to adjust rules. | M |
| FR-03 | Document upload & tagging | Officer uploads a file, selects its document type, and enters issue date and (if applicable) expiry date. Multiple files per type allowed; latest issue date governs. | M |
| FR-04 | Missing-document detection | Engine flags every required (or condition-triggered) checklist item with no uploaded document as Missing. | M |
| FR-05 | Expiry detection | Engine flags documents past their hard expiry date, or older than the freshness window at the expected decision date, as Expired. | M |
| FR-06 | Expiring-soon warning | Documents that will breach freshness within a configurable warning horizon (default 7 days) are flagged Expiring Soon (warning, not blocker). | M |
| FR-07 | Completeness report | Per application: item-by-item status table, reason for each defect (e.g. "Bank statement older than 30 days at decision date"), completeness score (% valid required items), and overall status: Incomplete / Complete with Warnings / Decision-Ready. | M |
| FR-08 | Decision-ready gate | Application may be marked decision-ready only when zero Missing and zero Expired required items remain; warnings allowed with acknowledgment. | M |
| FR-09 | Re-check loop | After new uploads, re-run the check on demand; report and status refresh immediately; superseded documents remain in history. | M |
| FR-10 | Pipeline dashboard | List of applications with product, completeness score, status, and top defect counts; filter by status. | S |
| FR-11 | Exportable gap list | Download the completeness report / borrower request list as PDF or CSV for sharing. | S |
| FR-12 | Audit trail | Every check run stored with timestamp, rules version, inputs, and results; viewable per application. | S |
| FR-13 | Conditional requirements | Support at least one condition-driven rule (e.g. business registration required only for self-employed applicants; co-applicant ID required if joint application). | S |
| FR-14 | Bulk seeded demo data | Preloaded sample applications covering happy path, missing docs, expired docs, and expiring-soon cases for the demo. | M |
| FR-15 | Simulated decision-date awareness | Freshness evaluated against expected decision date (submission date + configurable processing SLA), not just today. | S |

> **Traceability note.** FR-15 is marked **S** here but the PRD §7.1 marks Decision-Date Expiry Forecast as **Must have** and names it differentiator #1. These conflict. Resolution: FR-15 is promoted to **M** — the forecast is the product's core wedge and cannot be cut without collapsing the pitch. Recorded in §5.3 scope-change log.

### 6.2 Illustrative checklist rules (seed data)

Freshness windows below are illustrative defaults for the demo, to be confirmed with the business; they are configuration, not hard-coded logic.

| Document type | Personal — Salaried | Personal — Self-Employed | Home Loan | Max age / expiry rule | Evidence check 🆕 |
| --- | --- | --- | --- | --- | --- |
| Government photo ID | Required | Required | Required | Hard expiry date must be in the future | — |
| Address proof | Required | Required | Required | ≤ 90 days old | ✅ ANZ: ID bills "less than three months old" (E2) |
| Payslips | Required (last 3 months) | Not applicable | Required (last 3 months) | ≤ 60 days old | ✅ AMP: "less than 60 days old at the date the loan was submitted" (E1); ANZ: "no older than 60 days" (E2); Macquarie: 60 days (E3) |
| Bank statements | Required (last 6 months) | Required (last 12 months) | Required (last 6 months) | ≤ 30 days old at decision date | ✅ AMP: loan statements "less than 30 days old from the date of application submission" (E1) |
| Tax returns | Not applicable | Required (last 2 years) | Conditional (self-employed) | Latest assessment year | ✅ ANZ: tax docs "not older than 22½ months"; tax notice "less than 12 months old" (E2) |
| Business registration | Not applicable | Required | Not applicable | Hard expiry must be in the future | — |
| Employment verification letter | Conditional (tenure < 1 yr) | Not applicable | Conditional | ≤ 30 days old | ⚠️ **CONTRADICTED** — AMP: employment letter "dated within the last 60 days" (E1). **Recommend 60 days.** See below |
| Property valuation report | Not applicable | Not applicable | Required | ≤ 180 days old | — |
| Credit bureau report | Required | Required | Required | ≤ 30 days old at decision date | ✅ IITL: "Credit Bureau report should be dated within 30 days prior to date" (E4) |
| Insurance certificate | Not applicable | Not applicable | Conditional (property) | Hard expiry must be in the future | — |

#### 🆕 Evidence-based correction — action required

**The 30-day employment verification letter window is not supported by evidence and is contradicted by a Tier A source.** AMP's published policy allows 60 days. Recommend changing the seed value to **60 days** and logging it in §5.3.

This is a small change with an outsized demo benefit: it lets the team say *"we validated our default rule values against published lender credit policy, found one that was wrong, and corrected it"* — which demonstrates the policy-sandbox capability doing real work rather than being theatre.

**Measurement-date discrepancy — must be disclosed.** All Tier A sources measure document age **at submission date**. ReadyFile measures at **expected decision date** (BR-02), which is deliberately stricter. This is a product choice and a differentiator, not an industry standard. Do not claim lenders already do this. See §2.3 CE-2.

### 6.3 Business rules

| ID | Rule |
| --- | --- |
| BR-01 | A required item is satisfied only by a document that is both present and within its freshness/expiry rule; presence alone is insufficient. |
| BR-02 | Freshness is measured against the expected decision date (submission + processing SLA) so documents that will expire mid-process are caught at intake. *Stricter than published market practice — see §6.2.* |
| BR-03 | When multiple files exist for one document type, the one with the latest issue date is evaluated; older versions are retained for audit. |
| BR-04 | "Expiring Soon" is a warning and never blocks decision-ready status; Missing and Expired required items always block it. |
| BR-05 | Not-applicable items never count against the completeness score. |
| BR-06 | Every status change is traceable to a check run (timestamp + rule-set version). |
| BR-07 | Rule changes apply on the next check run; historical check results are never rewritten. |

### 6.4 Non-functional requirements (MVP-appropriate)

| ID | Requirement | MVP target |
| --- | --- | --- |
| NFR-01 | Responsiveness | Completeness check returns in < 5 seconds for a package of ≤ 20 documents |
| NFR-02 | Usability | A loan officer can complete intake → check → gap list with no training beyond a 1-minute walkthrough; statuses color-coded and self-explanatory |
| NFR-03 | Data handling | Demo uses synthetic borrower data only; no real PII. Uploaded files stored with application-scoped access; note production requirements (encryption at rest/in transit, retention policy) as post-MVP |
| NFR-04 | Configurability | Adding a loan product or editing freshness windows requires only configuration changes, not code changes |
| NFR-05 | Reliability | Check engine is deterministic: same inputs + same rules ⇒ same result (essential for audit and demo stability) |
| NFR-06 | Portability | Runs locally or on a single cloud instance for the demo; no dependency on bank infrastructure |

---

## 7. Data Requirements

| Entity | Key fields |
| --- | --- |
| Application | ID, borrower name (synthetic), product, amount, submission date, expected decision date, status |
| Checklist rule | Product, document type, required/conditional/optional, condition expression, max age days, hard-expiry flag, warning horizon |
| Document | ID, application ID, type, file reference, issue date, expiry date (optional), upload timestamp, version |
| Check run | ID, application ID, timestamp, rule-set version, per-item results, overall status, completeness score |

All demo data must be synthetic. Rule configuration should be human-readable (e.g. JSON/YAML or a table) so business reviewers can validate the checklist without reading code.

---

## 8. Assumptions, Constraints, and Dependencies

### 8.1 Assumptions

- Document dates are entered manually at upload for the MVP; officers enter them accurately in the demo scenario.
- Freshness windows in §6.2 are placeholders acceptable for demonstration; a real deployment requires sign-off from Credit Policy and Compliance. *(Partially superseded — see §6.2 evidence check: most values now have Tier A support.)*
- Two to three loan products are sufficient to prove the concept.

### 8.2 Constraints

- Hackathon time box: build must prioritize FR items marked **M**; **S** items only after the end-to-end demo flow works.
- Small team; prefer a simple stack (web front end + lightweight API + file/DB storage + rules config) over heavy infrastructure.
- No access to real bank systems or real customer data.

### 8.3 Dependencies

- Seeded rule sets and synthetic sample documents prepared before demo rehearsal.
- Decision on demo products and SLA value (default: 5 business days) made early so seed data is consistent.

---

## 9. Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Manual date entry seen as "not real automation" by judges | Demo credibility | Position OCR auto-extraction as the explicit next iteration; show the rules engine as the core value; optionally add one canned OCR extraction as a stretch demo |
| Scope creep into OCR/integrations | MVP not finished | Enforce §5.2 out-of-scope list **and the §5.3 boundary tests**; M-priority items first |
| Wrong freshness rules misrepresent bank policy | Business validity | 🆕 **Substantially mitigated** — §6.2 now validates 6 of 10 rule values against Tier A primary lender policy. Remaining: label all rules as illustrative config; validate with any FSI mentor available |
| Real PII accidentally used in demo | Compliance breach | Synthetic data only; review seed files before demo; CI check on synthetic marker (TRD SEC-01) |
| Demo failure on stage | Presentation risk | Pre-seeded applications (FR-14) + deterministic engine (NFR-05) + rehearsed fallback script |
| 🆕 **Judge cites a vendor claim that rules engines over-request documents** | Positioning undermined | Pre-empt with CE-1 rebuttal (§2.3): compete on explainability and auditability, not follow-up minimisation |
| 🆕 **Team claims market-standard status for decision-date forecasting** | Credibility loss if challenged | Disclose CE-2 proactively: it is stricter than published practice, by design |

---

## 10. MVP Acceptance Criteria (Demo Script)

The MVP is accepted when the following flow runs successfully end-to-end:

1. Officer creates a **Personal Loan — Salaried** application; system loads its checklist.
2. Officer uploads a partial package including one **expired** bank statement (issue date 45 days ago) and omits the credit bureau report.
3. Within 5 seconds the report shows: bank statement = Expired (older than 30 days at decision date), credit bureau report = Missing, ID = Present-Valid, plus a completeness score and status Incomplete.
4. Application cannot be marked decision-ready (FR-08 blocks it).
5. Officer uploads a fresh bank statement and the credit report, re-runs the check; status becomes **Decision-Ready** (or Complete with Warnings if an expiring-soon item exists), and the audit trail shows both check runs.
6. Dashboard shows the application moving from Incomplete to Decision-Ready; gap list export works (if FR-11 delivered).

---

## 11. Future Enhancements (Post-Hackathon Roadmap)

1. **OCR/AI extraction** of document type, issue/expiry dates, and key fields — removes manual entry, the biggest adoption barrier. Pairs with, does not replace, the rules engine (see CE-1).
2. **LOS/core banking integration** to run the check inside the existing origination workflow.
3. **Automated, consolidated borrower requests** (email/SMS) with secure upload links.
4. **Authenticity and tamper checks**; duplicate-document detection.
5. **Policy-governed rule management** with maker-checker approval and jurisdiction-specific regulatory packs (anchor: EBA/GL/2020/06, E5).
6. **Analytics on defect patterns** (which documents most often missing/expired) to fix upstream collection processes.

---

## 12. Glossary

| Term | Meaning |
| --- | --- |
| LOS | Loan Origination System |
| TAT | Turnaround Time |
| Freshness window | Maximum permitted age of a document at the decision date |
| Hard expiry | Explicit expiry date printed on a document (e.g. ID card) |
| Decision-ready | Application state with all required documents present and valid |
| KYC | Know Your Customer |
| SLA | Service Level Agreement (here: expected processing time used to compute the decision date) |

---

## Appendix A — Change log

| Version | Date | Change | Author |
| --- | --- | --- | --- |
| 1.1 | 2026-11-16 | Original draft for hackathon build | Loan Operations / Hackathon Team |
| 1.2 | 2026-11-20 | Markdown conversion. Added §2.3 pain validation with 11-source evidence register and confidence tiers; rewrote §3.2 as split baseline KPI register; added §5.3 scope boundary tests, adjudications and change log; added evidence column to §6.2 and one Tier A contradiction (employment verification letter 30 → 60 days proposed); added two counter-evidence risks to §9; promoted FR-15 to M to resolve a BRD/PRD priority conflict | Review pass |
