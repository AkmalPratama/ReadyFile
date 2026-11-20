# Product Requirements Document

## ReadyFile — Loan Document Completeness Checker (Hackathon MVP)

> **Know at intake. Decide on time.**

| Item | Detail |
| --- | --- |
| Document version | 1.2 (Markdown edition) |
| Date | 16 November 2026 (v1.1) · converted and extended 20 November 2026 |
| Source document | ReadyFile — Business Requirements Document v1.2 |
| Product domain | Financial Services — Retail and SME Lending Operations |
| Product stage | Hackathon MVP / prototype for lender workflow validation |
| Primary users | Loan officers, intake agents, underwriters, operations managers |
| Status | Draft for build planning |
| Source | `ReadyFile_PRD.docx` v1.1, QMind notebook `ReadyFile` |

### About this edition

Faithful Markdown conversion of PRD v1.1 with **four gap-fill additions**:

> 🆕 **[GAP FILL]** — added 2026-11-20, not present in the original v1.1.

1. **§5.3 Handoff Map** — the original §5 mapped personas and jobs-to-be-done but never specified *who hands what to whom, at which gate, and what happens when the handoff fails*. Every defect this product detects becomes a handoff; without this map the fix pack has no defined consumer.
2. **§8.6 Exception Catalogue** — the original covered the happy path and §8.4 input validation only. 24 failure modes now specified with detection point, behaviour, message, and blocking effect.
3. **§17 Measurable Pass Criteria** — the original §17 acceptance criteria were Given/When/Then narratives without thresholds or measurement methods, so they could not be failed objectively. Now numbered with a measurable assertion, method, and owner per criterion.
4. **§10.7 Rule-Based Module Scope** — separates what is genuinely driven by configuration from what is hard-coded product logic. Prevents the demo claim "everything is configurable" from being falsified by a judge finding one hard-coded value.

One **citation defect** in the original §3 is flagged inline.

---

## 1. Product Summary

**ReadyFile** (the Loan Document Completeness Checker) is an intake-time readiness tool for loan operations. It checks whether a borrower's document package is complete, current, and suitable for underwriting before the file enters the credit review queue.

The product is not intended to replace a full loan origination system or a document AI extraction platform. Its MVP wedge is a focused, explainable, rules-driven readiness layer that prevents incomplete and stale document packages from causing downstream rework.

The core product promise is: **know in under one minute whether a loan file is decision-ready, why it is not, and exactly what to request next.**

---

## 2. Product Vision

Loan processing should not stall because a required document was missing or because a document that was valid at upload became stale before underwriting. The product gives lending teams a fast, auditable document readiness gate that is configurable by product policy and understandable to both operations users and business reviewers.

The winning MVP experience combines four differentiating capabilities:

1. **Decision-Date Expiry Forecast** — checks document freshness against the expected underwriting decision date, not only today's date.
2. **One-Click Borrower Fix Pack** — turns missing and expired items into a consolidated, borrower-friendly request list with reasons and upload guidance.
3. **Explainable Readiness Score** — shows why a file is blocked, what will unblock it, and which rule caused each result.
4. **Policy-as-Configuration Sandbox** — lets the team change product checklists and freshness windows without code changes, then preview the impact on sample applications.

---

## 3. Market Context and Differentiation

Existing lending platforms already support digital document collection, document status tracking, and AI document analysis. Public product information describes Encompass eFolder documents as entries that let users track document status as a loan moves through the pipeline. nCino Document Manager positions around eliminating paper files and enabling a fully electronic loan file process. Blend Autopilot publicly describes document review and needs-list generation, while Ocolus describes extraction, validation, and analysis of uploaded borrower documents.

> ⚠️ **Citation defect (original v1.1).** The Encompass Developer Connect reference was recorded at host `developer.icesmorgagetechnology.com`, a corruption of *ICE Mortgage Technology*. That URL should be re-verified against the real ICE developer portal or removed before the PRD is shared externally. Tracked as **OQ-6**.

This MVP should therefore avoid competing head-on with enterprise LOS suites or full document AI platforms. Its differentiation is a narrow, fast-to-deploy **readiness intelligence layer**: product-policy rules, decision-date expiry simulation, transparent explanations, and action-ready borrower requests.

| Market capability | Common existing pattern | MVP differentiation |
| --- | --- | --- |
| Document tracking | Track uploaded/requested document status in the loan file | Block readiness when required documents are missing, expired, or stale at expected decision date |
| Needs-list generation | Generate needs lists from document review | Produce a borrower fix pack grouped by document type, with reason codes and freshness guidance |
| Document AI | Extract and analyze document content | Keep MVP deterministic with manual date capture; add OCR later without changing the rules engine |
| Workflow configuration | Configure workflows inside larger platforms | Provide a lightweight policy sandbox for hackathon demo and business validation |
| Auditability | Store documents and workflow history | Store every check run with rule version, decision date, and per-item explanation |

The product claim should be precise: not *"we are the first document checker,"* but *"we prevent avoidable underwriting rework by forecasting document readiness at intake and converting defects into a single actionable fix pack."*

> 🆕 **Competitive counter-position (see BRD §2.3 CE-1).** Blend markets Autopilot as delivering "up to 50% fewer unnecessary follow-ups **compared to a rules engine**." An incumbent is explicitly positioning against the approach ReadyFile takes. Do not claim superiority on follow-up volume. Claim **explainability and auditability** — every result traces to a rule ID and version, which is what Credit Policy and Compliance can sign off on and an opaque model cannot offer.

### Market references

| Ref | Source | URL |
| --- | --- | --- |
| M1 | Blend — *From Upload to Underwriting in 15 Seconds: Autopilot* | https://blend.com/blog/blend-momentum/blend-autopilot-automated-underwriting-document-review/ |
| M2 | nCino — Document Management Solution | https://www.ncino.com/solutions/document-manager |
| M3 | Ocolus — Product Demo | https://www.ocolus.com/video/ocolus-product-demo-video/ |
| M4 | Encompass Developer Connect — Manage Documents | ⚠️ **unverified, see above** |

---

## 4. Goals and Non-Goals

### 4.1 Product goals

| ID | Goal | MVP measurement |
| --- | --- | --- |
| PG-01 | Detect missing required documents at intake | 100% of seeded missing-required cases flagged |
| PG-02 | Detect expired and stale documents before underwriting | ≥ 95% of seeded expiry/freshness defects flagged |
| PG-03 | Reduce borrower rework loops | One consolidated fix pack generated per incomplete application |
| PG-04 | Make readiness explainable | Every blocked item shows reason, rule ID, and next action |
| PG-05 | Prove configurability | At least one product rule change demonstrated without code deployment |

### 4.2 Non-goals for MVP

- Full OCR or AI extraction from uploaded files.
- Fraud detection, tamper detection, or document authenticity scoring.
- Production LOS/core banking integration.
- Real borrower email/SMS sending.
- Real customer PII handling.
- Credit decisioning, income calculation, or underwriting recommendation.
- Complex role-based access control beyond a simple demo login or local demo mode.

> 🆕 **Note.** The non-goal above says "complex RBAC." A *minimal* role/permission matrix is still required and is specified in TRD §12.1 — without it the rule sandbox has no access boundary at all, which is a demo-safety problem, not just a production one.

---

## 5. Target Users and Jobs To Be Done

| Persona | Job to be done | Product value |
| --- | --- | --- |
| Loan officer / intake agent | "When I receive a loan package, help me know what is missing before I send it onward." | Instant checklist, defect reasons, fix pack |
| Underwriter / credit analyst | "When I open a file, help me trust that required documents are present and current." | Decision-ready gate and audit trail |
| Operations manager | "When I manage the queue, help me see which files can move and which are blocked." | Pipeline dashboard and top defect reasons |
| Borrower, indirect user | "When documents are needed, tell me exactly what to provide and why." | Clear consolidated request list rather than repeated chases |
| Credit policy / compliance reviewer | "When rules are applied, help me verify what was checked and against which policy version." | Rule versioning and check-run history |

### 5.3 Handoff Map

> 🆕 **[GAP FILL]** Added 2026-11-20. The persona table says who uses the product; it does not say where work moves between them. ReadyFile's entire value is *at a boundary* — it sits between intake and underwriting — so the handoffs are the product.

#### Handoff chain

```
Borrower ──(1) docs──▶ Loan Officer ──(2) intake + tagged docs──▶ ReadyFile
                                                                    │
                                                              (3) readiness report
                                                                    │
                                                                    ▼
Borrower ◀──(5) fix pack──  Loan Officer ◀──────────────────────────┘
    │                            ▲
    └──(6) replacement docs──────┘
                                 │
                          (4) re-check loop until gate passes
                                 │
                                 ▼
                        Underwriter ◀──(7) DECISION_READY file──┘
                             │
                      Ops Manager ◀──(8) pipeline visibility
                             │
              Credit Policy ◀──(9) rule version──▶ Compliance ◀──(10) audit trail
```

#### Handoff specification

| # | From → To | Artifact handed off | Gate / precondition | In-system? | Failure mode | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| H1 | Borrower → Loan Officer | Physical/digital document package | None | ❌ Out of band | Documents arrive unlabelled, wrong format, or partial | Loan Officer |
| H2 | Loan Officer → ReadyFile | Application record + tagged documents with issue/expiry dates | Product selected; dates entered per §8.4 | ✅ | Officer mis-tags a document type, or enters a wrong date — **the single largest accuracy risk in the MVP** (see E-19) | Loan Officer |
| H3 | ReadyFile → Loan Officer | Readiness report: per-item status, reason, rule ID, next action, score, overall status | Check run persisted | ✅ | Report renders but gate logic disagrees with items shown (E-14) | System |
| H4 | Loan Officer → Loan Officer | Re-check loop | New documents uploaded | ✅ | Officer re-runs check without uploading replacements, gets identical result, loses confidence (E-15) | Loan Officer |
| H5 | Loan Officer → Borrower | **Borrower fix pack** (CSV, on-screen, or copied text) | Overall status ≠ DECISION_READY | ❌ **Out of band in MVP** — officer emails/pastes manually | Fix pack generated but never delivered; no delivery tracking exists in MVP | Loan Officer |
| H6 | Borrower → Loan Officer | Replacement documents | Fix pack received and understood | ❌ Out of band | Borrower re-supplies the *same* stale document because guidance was unclear (the 36% repeat-request problem, BRD E6) | Loan Officer |
| H7 | Loan Officer → Underwriter | **DECISION_READY application** | Zero Missing + zero Expired required items; warnings acknowledged (FR-08 / PR-11) | ✅ Gate enforced | Officer attempts to bypass the gate (E-16); or gate passes but a document was mis-dated at H2 | Loan Officer |
| H8 | ReadyFile → Ops Manager | Pipeline dashboard: status, score, defect counts | ≥ 1 check run per listed application | ✅ | Dashboard shows stale status because it reads application.status rather than latest check run (E-17) | System |
| H9 | Credit Policy → ReadyFile | New rule version (via sandbox or config) | Schema validation passes; version increments | ✅ | Rule saved without preview, silently changing outcomes on live files (E-20) | Credit Policy (demo: authorized user) |
| H10 | ReadyFile → Compliance/Audit | Immutable check-run history + audit events | Every run stores rule version, decision date, input document versions | ✅ Append-only | Audit record cannot be replayed because input document versions were not stored (E-21) | System |

#### Critical handoff observations

- **H5 and H6 are out of band.** The MVP generates a fix pack but cannot deliver it or confirm receipt. This means PG-03 ("reduce borrower rework loops") is **not measurable within the MVP** — it can only be demonstrated as a capability, not proven as an outcome. State this plainly rather than implying a measured reduction.
- **H7 is the product's whole reason to exist.** The decision-ready gate is the only handoff ReadyFile actually enforces. Everything else is information transfer.
- **H2 is the weakest link.** Because dates are manually entered (no OCR), a wrong date at H2 silently produces a confident, wrong, fully-explained result at H3. Explainability does not cure bad input. Mitigation: E-19 validation plus a visible "date entered by officer" provenance marker on each evaluated item.

---

## 6. MVP Scope

### 6.1 In scope

- Create loan application with product, amount, submission date, expected processing SLA, and synthetic borrower details.
- Upload documents as PDF, JPG, or PNG and tag each document by type.
- Capture document issue date and optional hard expiry date at upload.
- Evaluate product-specific document requirements from configuration.
- Classify each checklist item as Present–Valid, Missing, Expired, Expiring Soon, or Not Applicable.
- Forecast freshness against expected decision date.
- Generate readiness score, decision-ready status, and explanation for each defect.
- Generate borrower fix pack as on-screen content and exportable CSV or PDF.
- Re-check after new uploads and preserve check-run history.
- Show a simple pipeline dashboard for seeded applications.
- Provide policy sandbox for editing rule configuration and previewing impact on sample applications.

### 6.2 Out of scope

- Automatic document classification from file content.
- Automatic extraction of issue/expiry dates from images or PDFs.
- Real-time integration with credit bureaus, bank data providers, LOS, or e-signature systems.
- Sending borrower communications externally.
- Maker-checker approval workflow for rule changes.
- Multi-jurisdiction regulatory policy packs.

---

## 7. Key Winning Features

### 7.1 Decision-Date Expiry Forecast

**Problem:** A bank statement or credit report may be valid today but stale by the time an underwriter reviews the file.

**Feature:** The product calculates expected decision date as submission date plus configurable processing SLA, then checks document freshness against that future date. This catches "will expire mid-process" defects at intake.

**MVP behavior:**

- Default processing SLA is 5 calendar days for MVP simplicity; business-day calculation is a stretch.
- User can adjust SLA on the application or in demo settings.
- Freshness rules use max-age-in-days or hard-expiry date.
- Result includes a plain-language explanation, for example: *"Bank statement will be 36 days old on expected decision date; max allowed is 30 days."*

**Why it wins:** It reframes the product from a static checklist into a proactive delay-prevention tool.

**Priority:** Must have.

> 🆕 **Honesty constraint.** Published lender credit policy measures document age **at submission date**, not at a forecast decision date (BRD §2.3 CE-2, sources E1–E3). This feature is therefore *stricter than observed market practice*. That is a legitimate, defensible product position — it catches mid-process expiry — but it must be presented as an innovation, never as an industry standard. If a judge knows lending policy, overstating this loses more credibility than the feature gains.

### 7.2 One-Click Borrower Fix Pack

**Problem:** Loan officers often send fragmented requests: one email for a missing ID, another for a fresh bank statement, another for an expired certificate. Borrowers respond slowly when requests are unclear.

**Feature:** The product generates a consolidated borrower-facing request list grouped by document type, with reason, required action, and acceptable freshness guidance.

**MVP behavior:**

- Includes only Missing and Expired required items.
- Includes Expiring Soon items as optional warnings if the officer selects "include warnings."
- Uses clear language: *"Please upload a bank statement issued within the last 30 days."*
- Export as CSV in MVP; PDF export is a stretch if time permits.
- Does not send email/SMS in MVP.

**Why it wins:** It converts detection into operational action and demonstrates a measurable reduction in rework loops.

**Priority:** Must have for demo; CSV export should be included if feasible.

> 🆕 **Claim correction.** "Demonstrates a *measurable* reduction in rework loops" overstates what the MVP can do. Delivery is out of band (H5/H6) and there is no receipt tracking, so reduction cannot be measured — only the *capability* to consolidate can be shown. Reword the pitch to: *"consolidates N fragmented requests into 1"* (measurable, see K4/PC-11).

### 7.3 Explainable Readiness Score and Blocking Reasons

**Problem:** A simple completeness percentage can be misleading. A file may be 90% complete but still blocked by one critical expired document.

**Feature:** The product shows both a score and a hard readiness gate. Every blocked item includes reason code, rule ID, and next best action.

**MVP behavior:**

- Completeness score = valid required items / applicable required items.
- Decision-ready status requires zero Missing and zero Expired required items.
- Expiring Soon warnings do not block readiness but require visible acknowledgment.
- Each item displays status, reason, rule ID, and recommended action.

**Why it wins:** It builds trust with operations, underwriting, and compliance reviewers because the result is explainable and deterministic.

**Priority:** Must have.

### 7.4 Policy-as-Configuration Sandbox

**Problem:** Hard-coded checklists are difficult to validate with business stakeholders and brittle across loan products.

**Feature:** Product rules live in a human-readable configuration file or admin table. The MVP includes a sandbox screen where a user can change a freshness window or required flag and preview how seeded applications change status.

**MVP behavior:**

- Seed at least two products: Personal Loan — Salaried and Personal Loan — Self-Employed.
- Home Loan can be included as a third product if time permits.
- Rule fields include product, document type, requirement level, condition, max age days, hard expiry flag, and warning horizon.
- Rule changes apply only to future check runs.
- Historical check results retain their original rule version.

**Why it wins:** It makes the demo feel enterprise-relevant without building a full enterprise rules platform.

**Priority:** Must have for configurability; visual sandbox is should-have.

### 7.5 Recheck Timeline and Audit Evidence

**Problem:** Teams need to know what changed between an incomplete file and a decision-ready file.

**Feature:** Every check run is stored with timestamp, rule version, expected decision date, document versions, per-item results, and overall status.

**MVP behavior:**

- Show at least two check runs in the demo: before and after document replacement.
- Preserve superseded documents in history.
- Allow user to view previous result summary.

**Why it wins:** It adds compliance-grade credibility to a lightweight hackathon prototype.

**Priority:** Should have; at minimum store check-run records.

---

## 8. User Experience Requirements

### 8.1 Primary navigation

- Applications dashboard.
- Application detail page.
- Document upload panel.
- Readiness report.
- Borrower fix pack.
- Rule configuration / sandbox.
- Check-run history.

### 8.2 Application dashboard

The dashboard should show application ID, synthetic borrower name, product, submission date, expected decision date, readiness status, completeness score, missing count, expired count, and expiring-soon count.

Required filters:

- All applications.
- Incomplete.
- Complete with warnings.
- Decision-ready.

Default sorting should place blocked applications with the nearest expected decision date first.

### 8.3 Application detail page

The detail page should contain:

- Application summary card.
- Document checklist table.
- Upload document action.
- Run completeness check action.
- Readiness status banner.
- Borrower fix pack panel.
- Check-run history link or section.

The checklist table should include document type, requirement level, uploaded document count, evaluated document date, status, reason, and next action.

### 8.4 Document upload experience

Upload form fields:

- Document type.
- File upload.
- Issue date.
- Hard expiry date, if applicable.
- Optional note.

Validation:

- Document type must belong to the selected product checklist.
- Issue date is required for freshness-based documents.
- Hard expiry date is required for hard-expiry document types.
- Issue date cannot be after submission date unless user marks it as a demo override.
- File type must be PDF, JPG, or PNG.

### 8.5 Readiness report

**Item status labels:**

| Status | Meaning |
| --- | --- |
| Present-Valid | Required document is present and current |
| Missing | Required document has no uploaded file |
| Expired | Hard expiry has passed, or freshness fails at expected decision date |
| Expiring Soon | Document will breach freshness within warning horizon |
| Not Applicable | Condition does not apply to this application |

**Overall statuses:**

| Status | Condition |
| --- | --- |
| Incomplete | One or more required items are Missing or Expired |
| Complete with Warnings | All required items are valid, but one or more unacknowledged warnings exist |
| Decision-Ready | All required items are valid and warnings, if any, have been acknowledged |

### 8.6 Exception Catalogue

> 🆕 **[GAP FILL]** Added 2026-11-20. The original specified only the happy path plus §8.4 field validation. Exceptions are where demos die and where judges probe. Each row specifies trigger, detection point, required behaviour, and whether it blocks.

**Blocking key:** 🔴 blocks the action · 🟡 permits with visible warning · 🟢 non-blocking

#### Upload and document metadata

| ID | Exception | Detected at | Required behaviour | Block | Message |
| --- | --- | --- | --- | --- | --- |
| E-01 | File exceeds 10 MB | Client + server (413) | Reject before transfer completes where possible; never store partial file | 🔴 | "File is 14 MB. Maximum is 10 MB." |
| E-02 | Unsupported type (not PDF/JPG/PNG) | Client + server MIME sniff (415) | Reject on magic bytes, not extension alone | 🔴 | "Only PDF, JPG and PNG are accepted." |
| E-03 | Extension/content mismatch (e.g. `.pdf` that is actually a PNG or an executable) | Server MIME sniff | Reject; log as a security event | 🔴 | "File content does not match its extension." |
| E-04 | Document type not in this product's checklist | Client + server | Reject; offer the valid list | 🔴 | "'Business registration' is not required for Personal Loan — Salaried." |
| E-05 | Issue date missing on a freshness-based type | Client + server | Reject save | 🔴 | "Issue date is required for bank statements." |
| E-06 | Expiry date missing on a hard-expiry type | Client + server | Reject save | 🔴 | "Expiry date is required for government photo ID." |
| E-07 | Issue date after submission date | Client + server | Reject unless officer sets an explicit **demo override** flag; flag is stored and surfaced on the report | 🟡 | "Issue date is after the application was submitted. Mark as demo override to continue." |
| E-08 | Expiry date before issue date | Client + server | Reject | 🔴 | "Expiry date cannot be earlier than issue date." |
| E-09 | Duplicate idempotency key (retry after network failure) | Server (409) | Return the **original** stored document; do not create a second version | 🟢 | "This upload was already received." |
| E-10 | Upload interrupted / network failure | Client | One automatic retry with the same idempotency key, then surface a manual retry | 🟡 | "Upload failed. Retrying… / Tap to retry." |

#### Check execution

| ID | Exception | Detected at | Required behaviour | Block | Message |
| --- | --- | --- | --- | --- | --- |
| E-11 | Product has no active rule version | Server (409) | Refuse to run; do not persist a partial check run | 🔴 | "No active checklist for this product. Activate a rule version first." |
| E-12 | Application has zero documents | Engine | Run normally; every required item is MISSING. Do **not** error | 🟢 | Report shows score 0, status Incomplete |
| E-13 | Conditional rule references an attribute absent from the application (e.g. `tenure_months` not supplied) | Engine | Treat as **NOT_APPLICABLE** and emit an explicit reason recording the missing attribute. Never silently treat as satisfied | 🟡 | "Rule PS-EVL-01 not evaluated: application attribute 'tenure_months' is not set." |
| E-14 | Check run persists but item rows fail to write | Server transaction | Roll back the entire run in one transaction; no partial run is ever visible | 🔴 | "Check could not be saved. Please re-run." |
| E-15 | Re-check with no new documents since last run | Server | Permitted (deterministic engine gives identical result) but show "no changes since last run" so the officer understands why nothing moved | 🟢 | "No new documents since the last check — result unchanged." |
| E-16 | Attempt to mark Decision-Ready while blocked | Server (409) | Refuse. Gate is enforced server-side, not only in UI, so it cannot be bypassed by editing client state | 🔴 | "Cannot mark decision-ready: 1 Missing, 1 Expired." |
| E-17 | Dashboard reads a stale status | Server | Application status is **derived only** from the latest persisted check run; never editable directly (TRD §7.1) | 🟢 | — |
| E-18 | Expected decision date already in the past | Engine | Run normally; nearly all freshness items will be Expired. Surface a banner explaining the SLA/submission date are inconsistent | 🟡 | "Expected decision date (2026-11-02) is in the past. Review the submission date or SLA." |

#### Data integrity and input trust

| ID | Exception | Detected at | Required behaviour | Block | Message |
| --- | --- | --- | --- | --- | --- |
| E-19 | Officer enters a **wrong but plausible** date | Undetectable by the system | This is the MVP's principal accuracy risk. Mitigate by labelling each evaluated item with its provenance: *"issue date entered by officer at upload"* so the report never implies the date was read from the document | 🟡 | Provenance marker on every evaluated item |
| E-20 | Rule version saved without running a preview | Server | Permit, but record whether a preview was run in the audit log; show a confirmation dialog naming the count of seeded applications affected | 🟡 | "Save version 4? This affects future checks on all Personal Loan — Salaried files." |
| E-21 | Historical check run cannot be replayed | Audit review | Every run must store rule version ID, expected decision date, engine version, and the evaluated document version IDs — sufficient for replay (TRD §7.4) | 🔴 (design constraint) | — |
| E-22 | Concurrent check runs on the same application | Server | Both may execute; each is a separate immutable row. Latest by `run_at` governs status. No locking required for MVP | 🟢 | — |

#### Export, mobile, and access

| ID | Exception | Detected at | Required behaviour | Block | Message |
| --- | --- | --- | --- | --- | --- |
| E-23 | CSV cell begins with `=`, `+`, `-`, or `@` (formula injection) | Export generator | Prefix the cell with an apostrophe (TRD SEC-06) | 🟢 | — |
| E-24 | Mobile capture attempted while offline | Client | Block submission with a clear reason. **Offline writes are out of scope** (TRD §6.2); last-fetched report remains readable with a stale banner | 🔴 (writes) | "You're offline. Document capture needs a connection to submit." |

#### Deliberately unhandled in MVP

Recorded so their absence is a decision, not an oversight: concurrent multi-officer edit conflicts beyond idempotency keys · partial-upload resume · virus scanning beyond MIME sniffing · rule version rollback/deletion (rule versions are immutable, never removed) · borrower-side authentication.

---

## 9. Functional Requirements

| ID | Requirement | Description | Priority |
| --- | --- | --- | --- |
| PR-01 | Create application | User creates application with product, amount, submission date, processing SLA, and synthetic borrower name. | Must |
| PR-02 | Load product checklist | System loads applicable checklist and rule version when product is selected. | Must |
| PR-03 | Upload and tag document | User uploads file, selects document type, enters issue date and optional expiry date. | Must |
| PR-04 | Validate document metadata | System validates required dates and supported file types before saving document. | Must |
| PR-05 | Run completeness check | User triggers check; system evaluates all applicable checklist items. | Must |
| PR-06 | Detect missing documents | Required item with no uploaded document is marked Missing. | Must |
| PR-07 | Detect hard expiry | Document with hard expiry date before expected decision date is marked Expired. | Must |
| PR-08 | Detect freshness expiry | Document older than max-age rule at expected decision date is marked Expired. | Must |
| PR-09 | Detect expiring soon | Document within warning horizon is marked Expiring Soon. | Must |
| PR-10 | Calculate readiness score | Score equals valid required items divided by applicable required items. | Must |
| PR-11 | Enforce decision-ready gate | System blocks Decision-Ready if any required item is Missing or Expired. | Must |
| PR-12 | Explain each result | Each checklist item shows status reason, rule ID, and next action. | Must |
| PR-13 | Generate borrower fix pack | System creates consolidated request list for Missing and Expired required items. | Must |
| PR-14 | Export fix pack | User can export fix pack as CSV; PDF is stretch. | Should |
| PR-15 | Recheck application | User can upload replacement documents and rerun check. | Must |
| PR-16 | Preserve document versions | Superseded documents remain stored and linked to prior check runs. | Should |
| PR-17 | Store check-run history | Each run stores timestamp, rule version, expected decision date, item results, and overall status. | Should |
| PR-18 | Dashboard view | User can view applications with status, score, and defect counts. | Should |
| PR-19 | Rule configuration | Authorized demo user can edit product rules through config file or simple admin UI. | Must |
| PR-20 | Rule impact preview | User can preview how a rule change affects seeded applications before saving. | Should |
| PR-21 | Conditional requirements | System supports at least one condition, such as self-employed requiring business registration. | Should |
| PR-22 | Seed demo data | System includes happy path, missing document, expired document, and expiring-soon scenarios. | Must |

> **Priority conflict resolved.** BRD v1.1 FR-15 (decision-date awareness) was marked **S** while PRD §7.1 named it differentiator #1 / Must have. BRD v1.2 promotes FR-15 to **M**. This PRD's position is unchanged and now consistent.

---

## 10. Core Rules and Logic

### 10.1 Expected decision date

`Expected decision date = submission date + processing SLA`

For MVP, SLA may be calculated as calendar days if business-day calculation is not implemented. The UI must label the calculation clearly. If business-day calculation is implemented, weekends should be excluded and holidays are out of scope.

### 10.2 Document selection

When multiple documents exist for the same document type, the system evaluates the document with the **latest issue date**. Previous versions remain in history. If the latest issue-date document is invalid but an older document is valid, the item **remains invalid** because the latest submitted evidence supersedes older evidence.

### 10.3 Freshness calculation

```
age_at_decision = expected_decision_date − issue_date   (integer days)

age_at_decision > max_age_days                                   → EXPIRED
max_age_days − warning_horizon ≤ age_at_decision ≤ max_age_days   → EXPIRING_SOON
otherwise                                                         → PRESENT_VALID
```

### 10.4 Hard expiry calculation

If a document has a hard expiry date and that date is **before** the expected decision date, the item is Expired. If hard expiry **equals** the expected decision date, the document is valid for that date but is flagged Expiring Soon.

### 10.5 Readiness score

```
score = (PRESENT_VALID + EXPIRING_SOON required items) / applicable required items × 100
```

Not Applicable items are excluded. Optional items are excluded unless configured as required. Expiring Soon items count as valid for the score but create a warning status. Result is rounded to an integer.

### 10.6 Overall status

- Any applicable required item is Missing or Expired → **Incomplete**
- Else any item is Expiring Soon and warnings are not acknowledged → **Complete with Warnings**
- Else → **Decision-Ready**

### 10.7 Rule-Based Module Scope

> 🆕 **[GAP FILL]** Added 2026-11-20. PG-05 claims configurability and §7.4 claims rules need no code changes. Neither the BRD nor the PRD said **which** behaviour is actually rule-driven. Without that boundary, the claim is unfalsifiable — and a judge who finds one hard-coded value can dismiss the whole thing.

#### Configuration-driven (changeable without a code deploy)

| Module / behaviour | Rule fields consumed | Source of truth | Requirement |
| --- | --- | --- | --- |
| Checklist applicability | `requirement` (required / conditional / optional) | `rule_versions.rules_json` | PR-02, PR-06 |
| Conditional evaluation | `condition` `{field, op, value}` — single comparison operator in MVP | `rule_versions.rules_json` | PR-21 |
| Freshness window | `freshness.max_age_days` | `rule_versions.rules_json` | PR-08 |
| Hard-expiry treatment | `hard_expiry` (bool) | `rule_versions.rules_json` | PR-07 |
| Warning horizon | `warning_horizon_days` (per rule set, default 7) | `rule_versions.rules_json` | PR-09 |
| Processing SLA | `processing_sla_days` | `applications` row, editable per application | PR-01 |
| Product catalogue | `products` rows | Database | PR-02 |
| Reason text numeric content | Interpolated from the rule values, not authored per case | Engine template | PR-12 |

#### Hard-coded product logic (NOT configurable in MVP — state this openly)

| Behaviour | Why it is fixed | Change requires |
| --- | --- | --- |
| The five item statuses | They are the product's vocabulary; UI, API, and audit schema all depend on them | Code + schema migration |
| The three overall statuses | Same | Code + schema migration |
| Score formula (§10.5) | Definitional. Making it configurable would make results incomparable across rule versions | Code |
| Decision-ready gate rule (§10.6, PR-11) | This is the compliance commitment. A configurable gate is not a gate | Code + policy sign-off |
| "Latest issue date governs" (§10.2) | Evidence-supersession principle (BRD BR-03) | Code |
| Boundary semantics — `age == max_age` ⇒ Expiring Soon, not Expired | Deterministic tie-break; must match the unit matrix (TRD §15.1) | Code + golden-file tests |
| Calendar-day SLA arithmetic | MVP simplification behind a `SlaCalculator` interface (TRD AD-07) | Code (interface already isolates it) |
| Accepted file types (PDF/JPG/PNG) | Security allowlist (TRD SEC-02) | Code |
| 10 MB upload limit | Security/size control (TRD SEC-02) | Env var — *partially* configurable |
| Compound conditions (AND/OR) | Explicitly post-MVP (TRD §8) | Code |

#### Demo instruction

When demonstrating PG-05, change a value from the **first** table (e.g. `max_age_days` 30 → 45). Never claim the second table is configurable. The honest framing is: *"policy is configuration; the compliance gate and the scoring definition are deliberately fixed code, because a gate you can edit is not a gate."* That is a stronger answer than an overclaim.

---

## 11. Seed Product Rules

The following rules are illustrative demo defaults and must be configurable. They are not regulatory or credit policy advice.

| Document type | Personal — Salaried | Personal — Self-Employed | Home Loan | Freshness / expiry rule |
| --- | --- | --- | --- | --- |
| Government photo ID | Required | Required | Required | Hard expiry must be on or after expected decision date |
| Address proof | Required | Required | Required | Max age 90 days |
| Payslips | Required | Not applicable | Required | Max age 60 days |
| Bank statements | Required | Required | Required | Max age 30 days at decision date |
| Tax returns | Not applicable | Required | Conditional | Latest assessment year; MVP can use issue-date proxy |
| Business registration | Not applicable | Required | Not applicable | Hard expiry must be on or after expected decision date |
| Employment verification letter | Conditional | Not applicable | Conditional | Max age 30 days ⚠️ |
| Property valuation report | Not applicable | Not applicable | Required | Max age 180 days |
| Credit bureau report | Required | Required | Required | Max age 30 days at decision date |
| Insurance certificate | Not applicable | Not applicable | Conditional | Hard expiry must be on or after expected decision date |

> 🆕 **⚠️ Evidence flag.** BRD v1.2 §6.2 validated these values against published lender credit policy. Six of ten match Tier A primary sources. **The employment verification letter at 30 days is contradicted** — AMP's published policy allows 60 days. Recommend changing the seed to **60 days**. Full evidence table in BRD §6.2.

---

## 12. Data Model

| Entity | Required fields | Notes |
| --- | --- | --- |
| Application | id, borrower_name, product_id, amount, submission_date, processing_sla_days, expected_decision_date, status | Borrower data must be synthetic |
| Product | id, name, active_rule_version_id | Seeded products for demo |
| ChecklistRule | id, product_id, document_type, requirement_level, condition, max_age_days, hard_expiry_required, warning_horizon_days | Stored in JSON/YAML or database table |
| Document | id, application_id, document_type, file_ref, issue_date, expiry_date, uploaded_at, version, note | Multiple versions per type allowed |
| CheckRun | id, application_id, run_at, rule_version, expected_decision_date, score, overall_status | Immutable historical record |
| CheckRunItem | id, check_run_id, document_type, evaluated_document_id, status, reason_code, reason_text, next_action | Supports explainability |
| FixPack | id, application_id, check_run_id, generated_at, included_warnings, export_format | Generated from latest check run |

> 🆕 **Missing entity.** No table records *who* performed an action (login, upload, rule save, warning acknowledgment, export). Check runs capture *what was evaluated* but not *who acted*. Compliance persona (§5) and BRD pain point P5 (weak audit trails) both require this. Add **`AuditEvent`** — specified in TRD §9 and §12.2.

---

## 13. API / Service Contract

The MVP may be implemented as a monolith, but the logical service boundaries should remain clear.

| Endpoint / service | Purpose |
| --- | --- |
| POST /applications | Create application |
| GET /applications | Dashboard list |
| GET /applications/{id} | Application detail |
| POST /applications/{id}/documents | Upload document metadata and file |
| POST /applications/{id}/check | Run completeness check |
| GET /applications/{id}/checks | Check-run history |
| GET /applications/{id}/fix-pack | Generate borrower fix pack |
| GET /applications/{id}/fix-pack.csv | Export fix pack |
| GET /products/{id}/rules | Retrieve active product rules |
| PUT /products/{id}/rules | Save new rule version |
| POST /products/{id}/rules/preview | Preview rule impact on seeded applications |

If no backend API is built, the same contracts should exist as internal functions to keep the demo architecture clean.

> 🆕 **Contract gaps.** The list omits endpoints the PRD's own requirements need: `POST /auth/login` (PR-19 authorized user), `POST /applications/{id}/checks/{runId}/ack-warnings` (§8.5 warnings require acknowledgment), `GET /products` (product picker for PR-01), and `GET /health` (demo reliability). Full specified contract with methods, status codes, and error envelope is in **TRD §10**.

---

## 14. Non-Functional Requirements

| ID | Requirement | MVP target |
| --- | --- | --- |
| NFR-01 | Performance | Completeness check returns within 5 seconds for up to 20 documents |
| NFR-02 | Determinism | Same application data and same rule version produce same result |
| NFR-03 | Usability | Loan officer can complete demo flow with less than 1 minute of guidance |
| NFR-04 | Configurability | Adding or editing a product rule does not require code changes |
| NFR-05 | Auditability | Check-run records are immutable after creation |
| NFR-06 | Privacy | Demo uses synthetic data only; no real borrower PII |
| NFR-07 | Portability | Runs locally or on a single cloud instance |
| NFR-08 | Security baseline | Uploaded files are application-scoped; no public file browsing in demo |
| NFR-09 | Accessibility | Status is conveyed by text and color, not color alone |

---

## 15. Analytics and Success Metrics

| Metric | Definition | MVP target |
| --- | --- | --- |
| Defect detection latency | Time from check trigger to report display | < 5 seconds |
| Seeded defect coverage | Correctly flagged seeded missing/expired cases | ≥ 95% |
| Fix pack generation rate | Incomplete applications with generated fix pack | 100% in demo |
| Recheck improvement | Applications moving from Incomplete to Decision-Ready after replacement docs | Demonstrated in at least one scenario |
| Rule-change agility | Time to modify a freshness rule and rerun check | < 2 minutes |
| Explanation completeness | Blocked items with reason and next action | 100% |

Post-MVP business metrics should include reduction in document-related rework cycles, reduction in time-to-decision, fewer borrower follow-up requests, and percentage of files entering underwriting as decision-ready.

> 🆕 These align 1:1 with BRD v1.2 §3.2 **Register B** (K1–K7). Register A holds the external industry benchmarks that must not be presented as ReadyFile measurements.

---

## 16. MVP Demo Story

The demo should tell a simple before-and-after story.

1. Loan officer opens a Personal Loan — Salaried application with expected decision date five days after submission.
2. Officer uploads a government ID, address proof, payslip, and a bank statement issued 27 days ago.
3. Credit bureau report is missing.
4. The checker flags the bank statement as **Expired** because it will be 32 days old at the expected decision date, exceeding the 30-day freshness rule.
5. The checker flags the credit bureau report as **Missing**.
6. The readiness banner shows **Incomplete** and blocks decision-ready status.
7. The officer clicks **Generate Borrower Fix Pack** and sees one consolidated request list.
8. Officer uploads a fresh bank statement and credit bureau report.
9. Officer reruns the check.
10. The file becomes **Decision-Ready**, and the check-run timeline shows the improvement.
11. Officer opens the policy sandbox and changes bank statement max age from 30 to 45 days, then previews impact on seeded files.

This story demonstrates detection, forecasting, actionability, rework reduction, auditability, and configurability in one flow.

> 🆕 **Step 4 is the money moment.** A statement that is valid *today* fails at the *decision date*. Rehearse the pause before revealing it — this single item is the entire differentiation argument.

---

## 17. Acceptance Criteria — Measurable Pass Criteria

> 🆕 **[GAP FILL]** Rewritten 2026-11-20. The original §17 gave Given/When/Then narratives with no thresholds, measurement methods, or owners, so a criterion could not objectively fail. Each is now a numbered, measurable assertion.

**Method key:** `U` unit test (rules-engine matrix) · `I` API integration test · `E` Playwright E2E · `M` manual rehearsal checklist · `G` golden-file determinism test
**Status:** every criterion below is a **release gate** unless marked *(stretch)*.

### 17.1 Core completeness

| ID | Measurable criterion | Threshold | Method | Req |
| --- | --- | --- | --- | --- |
| PC-01 | Required item with no uploaded document is marked MISSING | 100% of seeded cases | U, I | PR-06 |
| PC-02 | Required item whose age at decision > max_age_days is marked EXPIRED | 100% of seeded cases | U, I | PR-08 |
| PC-03 | Application with ≥ 1 MISSING or EXPIRED required item returns overall_status = INCOMPLETE | 100% | U | PR-11 |
| PC-04 | Application with all required items valid and no unacknowledged warnings returns DECISION_READY | 100% | U, E | PR-11 |
| PC-05 | Seeded missing + expired defects correctly flagged | **≥ 95%** | U golden matrix | PG-01/02 |

### 17.2 Decision-date forecast

| ID | Measurable criterion | Threshold | Method | Req |
| --- | --- | --- | --- | --- |
| PC-06 | Statement 27 days old, max_age 30, decision date +5 days ⇒ EXPIRED (32 > 30) | Exact match | U | PR-08 |
| PC-07 | Boundary: age at decision == max_age ⇒ **EXPIRING_SOON** (not EXPIRED) | Exact match | U | §10.3 |
| PC-08 | Boundary: age at decision == max_age + 1 ⇒ EXPIRED | Exact match | U | §10.3 |
| PC-09 | Boundary: age at decision == max_age − warning_horizon ⇒ EXPIRING_SOON | Exact match | U | PR-09 |
| PC-10 | Changing the expected decision date and re-running updates every freshness result accordingly | 100% of freshness items re-evaluated | U, I | §10.1 |
| PC-10a | Hard expiry == decision date ⇒ EXPIRING_SOON; hard expiry == decision − 1 ⇒ EXPIRED | Exact match | U | §10.4 |

### 17.3 Borrower fix pack

| ID | Measurable criterion | Threshold | Method | Req |
| --- | --- | --- | --- | --- |
| PC-11 | Application with 2 MISSING + 1 EXPIRED produces **exactly 1** fix pack containing **exactly 3** entries | 1 pack / 3 entries | I, E | PR-13 |
| PC-12 | NOT_APPLICABLE items never appear in the fix pack | 0 occurrences | U, I | PR-13 |
| PC-13 | EXPIRING_SOON items appear **only** when `include_warnings=true` | 0 when false, N when true | I | PR-13 |
| PC-14 | Every fix pack entry contains document type, plain-language request, freshness guidance, and reason | 4/4 fields, 100% of entries | I | PR-12/13 |
| PC-15 | CSV export: UTF-8, header row, one row per item, opens without encoding errors | Byte-checked | I | PR-14 |
| PC-16 | CSV cells beginning `=` `+` `-` `@` are apostrophe-prefixed | 100% | U | SEC-06 |

### 17.4 Explainability

| ID | Measurable criterion | Threshold | Method | Req |
| --- | --- | --- | --- | --- |
| PC-17 | Every MISSING, EXPIRED, EXPIRING_SOON item carries non-empty reason_text **and** next_action | **100%** | U, I | PR-12 |
| PC-18 | Every item result carries a rule_id resolvable to the rule version used | **100%** | I | PR-12 |
| PC-19 | reason_text for freshness failures embeds the concrete numbers (age at decision, max allowed) | 100% of freshness failures | G golden file | PR-12 |
| PC-20 | Each evaluated item displays the issue-date provenance marker (E-19) | 100% | E | E-19 |

### 17.5 Rule sandbox

| ID | Measurable criterion | Threshold | Method | Req |
| --- | --- | --- | --- | --- |
| PC-21 | Changing max_age 30 → 45 and previewing updates seeded application statuses **in preview only** | 0 historical rows modified | I, E | PR-20 |
| PC-22 | Saving a new rule version increments the version number and marks it active | +1, active flag set | I | PR-19 |
| PC-23 | A check run after save records the **new** rule version ID | Exact match | I | BR-07 |
| PC-24 | Historical check runs retain their original rule version and results after a rule save | Byte-identical re-read | I | NFR-05 |
| PC-25 | Invalid rule draft (unknown document type, negative max_age, missing hard_expiry flag) is rejected | 400 with field detail | I | TRD §7.6 |
| PC-26 | Edit → save → recheck completed with **zero code changes and zero redeploy** | 0 deploys | E | PG-05 |
| PC-27 | Rule-change agility: modify a freshness rule and re-run a check | **< 2 minutes** | M timed rehearsal | K5 |

### 17.6 Determinism, audit, and access

| ID | Measurable criterion | Threshold | Method | Req |
| --- | --- | --- | --- | --- |
| PC-28 | Same inputs + same rule version evaluated twice ⇒ byte-identical result including item ordering | 100% | G | NFR-02 |
| PC-29 | Engine contains no `Date.now()`, no randomness, no I/O | 0 occurrences (static check) | U, lint rule | TC-02 |
| PC-30 | Any historical check run is replayable from stored inputs + rule version | 100% of stored runs | U replay test | NFR-05, E-21 |
| PC-31 | `check_runs` and `check_run_items` have **no** UPDATE or DELETE code path | 0 occurrences | Static analysis, I | NFR-05 |
| PC-32 | Every mutating action writes one AuditEvent with actor, action, target, timestamp | 100% | I | TRD §12.2 |
| PC-33 | Unauthenticated request to any non-public endpoint returns 401 | 100% | I | SEC-04 |
| PC-34 | Non-manager role calling `PUT /products/{id}/rules` returns 403 | 100% | I | TRD §12.1 |
| PC-35 | User A cannot read or upload to User B's application | 403/404, 100% | I | SEC-03 |

### 17.7 Performance, UX, and delivery

| ID | Measurable criterion | Threshold | Method | Req |
| --- | --- | --- | --- | --- |
| PC-36 | Check latency, 20 documents, local | p95 **< 500 ms** | Load script (50 sequential) | NFR-01 |
| PC-37 | Check latency, 20 documents, cloud | p95 **< 2 s**; hard budget 5 s | Load script | NFR-01 |
| PC-38 | Web demo flow click count (intake → report) | **≤ 8 clicks** | M rehearsal | NFR-03 |
| PC-39 | Mobile capture-upload tap count | **≤ 6 taps** | M rehearsal | NFR-03 |
| PC-40 | Status conveyed by text + icon + colour, never colour alone | 100% of status chips | M accessibility audit | NFR-09 |
| PC-41 | WCAG AA contrast on status chips | Passes | M audit | NFR-09 |
| PC-42 | Recheck conversion: ≥ 1 seeded application moves INCOMPLETE → DECISION_READY after replacement docs | ≥ 1 | E, I | K6 |
| PC-43 | Upload > 10 MB rejected with 413 and no partial file stored | 100% | I | E-01 |
| PC-44 | Non-PDF/JPG/PNG rejected by MIME sniff even with a spoofed extension | 100% | I | E-03 |
| PC-45 | Duplicate idempotency key returns the original document, creating no second version | 1 row | I | E-09 |
| PC-46 | `docker compose up` (cloud) and `npm run demo` (SQLite) both reach a working seeded state on a clean machine | Both pass | M dry run | NFR-07 |
| PC-47 | Seed script is idempotent; `seed:reset` restores the exact initial state | Identical re-run | I | TRD §14.3 |
| PC-48 | PDF fix pack export | Works | M | *(stretch)* |
| PC-49 | Business-day SLA calculation excludes weekends | Works | U | *(stretch)* |

**Release gate:** PC-01 … PC-47 all pass. PC-48/PC-49 are stretch and do not block.

---

## 18. Release Plan

### 18.1 Hackathon build cut

**Must ship:**

- Application creation.
- Document upload and metadata capture.
- Product checklist rules for at least two products.
- Completeness engine with Missing, Expired, Expiring Soon, Present–Valid, and Not Applicable statuses.
- Decision-date freshness calculation.
- Readiness score and decision-ready gate.
- Borrower fix pack on screen.
- Recheck flow.
- Seeded demo scenarios.

**Should ship if time permits:**

- Dashboard filters.
- CSV export.
- Check-run history UI.
- Rule sandbox impact preview.
- Conditional requirement support.

**Stretch:**

- PDF fix pack.
- One canned OCR extraction demo to show future automation.
- Business-day SLA calculation.
- Simple warning acknowledgment workflow.

> 🆕 **Correction.** "Simple warning acknowledgment workflow" is listed as stretch, but §8.5 and FR-08 make acknowledgment a **precondition of DECISION_READY**. If it is cut, the Decision-Ready status becomes unreachable whenever a warning exists — breaking PC-04 and demo step 10. Move acknowledgment into **Must ship**. Its cost is one endpoint plus a timestamp (TRD `POST /checks/{runId}/ack-warnings`).

### 18.2 Post-MVP roadmap

1. OCR/AI extraction of document type, issue date, expiry date, and key fields.
2. Secure borrower upload portal and automated consolidated notifications.
3. LOS integration to embed readiness checks into existing origination workflows.
4. Policy governance with maker-checker approvals and jurisdiction-specific rule packs.
5. Document authenticity and duplicate detection.
6. Analytics on recurring defect patterns by product, channel, and borrower segment.

---

## 19. Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Market already has document AI and LOS document tools | Weak differentiation | Position as decision-date readiness and rework-prevention layer, not full document AI |
| Manual date entry feels too manual | Judge skepticism | Demo deterministic rules first; show OCR as next iteration or stretch canned extraction |
| Rule defaults are mistaken for real policy | Compliance concern | Label all rules as illustrative config requiring Credit Policy sign-off. 🆕 Now partly evidenced — BRD §6.2 |
| Scope creep into OCR or integrations | MVP misses demo deadline | Keep build cut focused on rules, readiness, fix pack, and recheck. 🆕 Enforce BRD §5.3 boundary tests |
| Real PII used accidentally | Privacy breach | Synthetic data only and pre-demo file review |
| Dashboard overbuilt | Core flow incomplete | Build application detail and check engine before dashboard polish |
| 🆕 **Incumbent markets against rules engines** (Blend: "50% fewer follow-ups than a rules engine") | Positioning undermined | Compete on explainability/auditability, not follow-up volume. BRD §2.3 CE-1 |
| 🆕 **Decision-date forecast overclaimed as market standard** | Credibility loss | Disclose that published policy measures at submission date; ReadyFile is deliberately stricter (§7.1) |
| 🆕 **Wrong officer-entered date yields a confident wrong verdict** (E-19) | Silent false result | Provenance marker on every evaluated item (PC-20); no claim that dates are read from documents |
| 🆕 **Acknowledgment cut as stretch ⇒ DECISION_READY unreachable** | Demo step 10 fails | Promoted to Must ship (§18.1) |

---

## 20. Open Questions

| ID | Question | 🆕 Recommended default | Blocks build? |
| --- | --- | --- | --- |
| OQ-1 | Which two loan products for the final demo: Personal Salaried + Self-Employed, or Personal + Home Loan? | **Salaried + Self-Employed** — the self-employed case exercises conditional rules (PR-21), which Home Loan does not | No |
| OQ-2 | Calendar days or business days for processing SLA? | **Calendar days** for MVP; `SlaCalculator` interface already isolates the upgrade (TRD AD-07). Label clearly in UI | No |
| OQ-3 | Should Expiring Soon block decision-ready for specific document types? | **No — warning-only** in MVP (BR-04). Per-type blocking is a post-MVP policy question needing Credit Policy input | No |
| OQ-4 | Is CSV export sufficient, or is PDF required for judging? | **CSV sufficient**; PDF is stretch (PC-48). "Copy as text" covers the email-paste demo path | No |
| OQ-5 | Policy sandbox editable in UI, or demonstrated via config file change? | **UI sandbox** — it is the visual proof of PG-05. Config-file-only weakens the demo | No |
| OQ-6 🆕 | Encompass citation host `developer.icesmorgagetechnology.com` does not resolve to a legitimate ICE reference | Re-verify against the real ICE Mortgage Technology developer portal, or drop the citation (§3) | No |
| OQ-7 🆕 | Employment verification letter window: keep 30 days or adopt the evidence-backed 60 days? | **60 days** (BRD §6.2, AMP policy E1) | No — config value only |

---

## 21. Glossary

| Term | Meaning |
| --- | --- |
| Decision-ready | Application state where all required documents are present and valid for underwriting |
| Expected decision date | Submission date plus configured processing SLA |
| Freshness window | Maximum allowed document age at expected decision date |
| Hard expiry | Explicit expiry date on a document, such as an ID or certificate |
| Borrower fix pack | Consolidated list of missing/expired document requests and guidance |
| Rule version | Immutable version of product checklist configuration used for a check run |
| LOS | Loan Origination System |
| OCR | Optical Character Recognition |
| PII | Personally Identifiable Information |

---

## Appendix A — Change log

| Version | Date | Change | Author |
| --- | --- | --- | --- |
| 1.1 | 2026-11-16 | Original draft for build planning | Hackathon Team |
| 1.2 | 2026-11-20 | Markdown conversion. Added §5.3 handoff map (10 handoffs with gates and failure modes); §8.6 exception catalogue (24 exceptions); rewrote §17 as 49 measurable pass criteria with thresholds, methods and release gate; added §10.7 rule-based module scope separating configurable from fixed logic. Flagged the Encompass citation defect (OQ-6); corrected the §7.2 "measurable rework reduction" overclaim; added the decision-date honesty constraint (§7.1); promoted warning acknowledgment from stretch to Must ship; noted the missing AuditEvent entity; recorded evidence flag on the employment verification letter rule | Review pass |
