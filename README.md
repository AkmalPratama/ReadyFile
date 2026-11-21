# ReadyFile

**Know at intake. Decide on time.**

A loan document completeness checker for retail & SME lending operations.
At intake it tells a loan officer which required documents are missing, which
are present but stale, and — the part market practice gets wrong — which will
*already have expired* by the time the file is decided. Freshness is measured
at the **expected decision date** (submission + the 5-calendar-day processing
SLA), not at upload.

Hackathon MVP. The rule engine, the specification set, an independent QA
phase, a presentation deck and a clickable delivery-layer mockup
(`05_demo/`, real engine in the browser, no backend) are complete. The
production API, web app and mobile companion are **not built yet** — see
[Status](#status) before demoing.

## Status

| Area | State |
| --- | --- |
| Specifications (BRD v1.2, PRD v1.3, TRD v1.2) | Done — `01_documents/` |
| Deterministic completeness engine | Done — 65 unit tests, all 16 rows of TRD §15.1 |
| Independent QA | Done — 149 acceptance tests, 56 manual scenarios, traceability, report |
| Presentation | Done — 18-slide deck + PDF, incl. demo-journey screenshots, `04_presentation/` |
| Delivery-layer mockup | Done — `05_demo/`: every PRD §5 screen, real engine in-tab, synthetic seed, no backend |
| API, database, upload path, production web app, mobile, fix pack, sandbox save | **Not built** (TRD §18 WP1 remainder, WP3–WP8) |
| Release gate (PRD §17, PC-01…PC-47) | **Not met** — 8 pass · 12 partial · 27 blocked |
| Open defects | DEF-07 (critical), DEF-06 (major), DEF-08 (minor) — `03_qa/qa-report.md` §5 |

Every number above is measured, not estimated; conditions and limits are
stated in [`03_qa/qa-report.md`](03_qa/qa-report.md).

## Repository layout

```
01_documents/     BRD.md, PRD.md, TRD.md — Markdown versions of the source
                  documents, with evidence tiers and explicitly marked gap-fills
02_source/        npm-workspace TypeScript monorepo (the runnable code)
  packages/core/         types, zod schemas, UTC date math, SLA arithmetic
  packages/rules-engine/ pure deterministic evaluator (depends only on core)
03_qa/            independent acceptance suite, manual scenarios, traceability
                  matrix, test plan and QA report (outside the npm workspace)
04_presentation/  index.html deck, ReadyFile-deck.pdf, journey screenshots,
                  presenter README
05_demo/          delivery-layer mockup: plain-ESM web app running the real
                  engine in the browser, synthetic seed, sessionStorage only
```

## How the engine decides

- **Five item statuses:** `PRESENT_VALID`, `EXPIRING_SOON`, `EXPIRED`,
  `MISSING`, `NOT_APPLICABLE`.
- **Freshness at the decision date:** with max age `M`, warning horizon `H`
  and document age `A` — `A > M` ⇒ EXPIRED; `M−H ≤ A ≤ M` ⇒ EXPIRING_SOON;
  `A < M−H` ⇒ PRESENT_VALID. Hard-expiry rules compare against the decision
  date with equality only (`expiry = decision` ⇒ EXPIRING_SOON).
- **Score:** `round(valid required ÷ applicable required × 100)`;
  EXPIRING_SOON counts as valid, optional and not-applicable items are excluded.
- **Gate:** any required item MISSING or EXPIRED ⇒ `INCOMPLETE`.
  Acknowledging a warning never clears a blocker.
- **Deterministic by construction:** no wall clock, no randomness, no I/O, no
  Node built-ins. Same inputs + same rule version ⇒ byte-identical JSON, so
  any run is replayable and every result traces to a named policy line.

## Requirements

- **Node.js ≥ 22** and npm (declared in `02_source/package.json` `engines`).
  Measured on Node v23.11.0 / npm 10.9.2, macOS arm64.
- No database, no environment variables, no network access and no build step
  are needed to run the engine or its tests. `tsx` runs the TypeScript directly.

## Run it

```bash
git clone https://github.com/AkmalPratama/ReadyFile.git
cd ReadyFile/02_source
npm install
npm run verify          # both typechecks + all 214 tests (~1 s of test time)
```

All commands below run from `02_source/`:

| Command | What it does |
| --- | --- |
| `npm run verify` | `typecheck` + `typecheck:qa` + `test:all` — the one-command check |
| `npm test` | 65 engine unit tests (TRD §15.1 matrix) |
| `npm run test:qa` | 149 independent acceptance tests from `03_qa/` |
| `npm run test:all` | Both suites, 214 tests / 70 suites |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run typecheck` | `tsc --noEmit` over the workspace, strict |
| `npm run typecheck:qa` | `tsc --noEmit` over the QA suite |

### See a verdict in your terminal

The engine runs standalone, and the PRD §16 demo story runs against it
directly. From `02_source/`:

```bash
node --import tsx --input-type=module -e '
import { evaluate } from "./packages/rules-engine/src/index.ts";
import fixtures from "../03_qa/automated/fixtures.ts";
const { salariedRuleSet, demoApplication, demoDocumentsAtStep2, demoDocumentsAtStep8 } = fixtures;
for (const [label, docs] of [["intake   ", demoDocumentsAtStep2()], ["after fix", demoDocumentsAtStep8()]]) {
  const r = evaluate({ application: demoApplication(), documents: docs, rules: salariedRuleSet() });
  console.log(label, "score=" + r.score, r.overallStatus, "blocking=" + r.blockingCount);
}
'
```

Verified output:

```
intake    score=60 INCOMPLETE blocking=2
after fix score=100 DECISION_READY blocking=0
```

At intake the bank statement is 27 days old — fresh enough today, but 32 days
old at the 7 Mar decision date, past its 30-day limit — and the credit bureau
report is missing. Replace those two documents and the same file becomes
Decision-Ready. The full eleven-step story, with every intermediate assertion,
is `03_qa/automated/demo-story.test.ts` (`npm run test:qa`).

All demo data is synthetic (BRD NFR-03, TRD SEC-01). No real borrower data
exists anywhere in this repository.

### Click through the demo mockup

`05_demo/` is a presentable web mockup of the full delivery layer — intake,
pipeline, report, fix pack, history, audit trail and policy sandbox — running
the **same engine** in the browser. No backend: state lives in
`sessionStorage`, uploads capture metadata only, roles come from a picker.
From the repo root:

```bash
bash 05_demo/serve.sh        # → http://localhost:8000/05_demo/
```

A local server is required because ES modules do not load from `file://`.
Deep links (`?as=officer|manager|auditor`), the seeded journey and the
real-vs-mocked boundary are documented in
[`05_demo/README.md`](05_demo/README.md).

### Present the project

Open [`04_presentation/index.html`](04_presentation/index.html) in a browser:
arrow keys / space to navigate, `F` fullscreen, `P` to print an 18-page 16:9
PDF, `#N` to deep-link a slide. A ready-made export is
[`04_presentation/ReadyFile-deck.pdf`](04_presentation/ReadyFile-deck.pdf).
Controls, slide map and sourcing notes:
[`04_presentation/README.md`](04_presentation/README.md).

## Measured outcome

214 tests / 70 suites / 0 failures · 0 TypeScript diagnostics under strict ·
0 dependency vulnerabilities (`npm audit`, full tree) · median engine latency
0.013 ms, p95 0.027 ms against a 500 ms budget (PC-36) · full `verify` ≈ 0.9 s.

Two limits stated plainly: no coverage tool is installed and there is no CI
pipeline, so "214 passing" says nothing about untested branches; latency is
engine-only — HTTP, database reads and serialization do not exist yet.
Details and reproduction commands: [`03_qa/qa-report.md`](03_qa/qa-report.md) §2.

## Known limitations and open decisions

- **No production delivery surface:** no API, database, upload path,
  production web app, mobile app, fix-pack generator or persisted sandbox.
  The `05_demo` mockup previews these screens with the real engine in-tab,
  but it is not the production build.
- **DEF-07 (critical, open):** a future-dated document evaluates as valid and
  can displace a genuine one, defeating the decision-ready gate.
- **DEF-06 (major, open):** a self-employed Home Loan applicant can never be
  Decision-Ready because one income-evidence document is unobtainable.
- **DEF-08 (minor, open):** two borrower-facing reason strings start lowercase.
- **OQ-1 / OQ-7:** which products are demoed, and the employment-verification
  letter window (30 vs 60 days), await a business decision; the QA report
  prices the impact of each option.

Open defects are pinned by *passing* tests that assert the wrong behaviour, so
they fail loudly the moment someone fixes them correctly.

## Roadmap (TRD §18 build order)

1. **WP1 remainder** — Prisma schema + `audit_events`, seed script, Fastify
   skeleton, demo login, authZ and audit middleware.
2. **WP2 remainder** — rule JSON for two products.
3. **WP3** — core API: applications, upload, check, check history.
4. **WP4** — web core flow: intake → upload → check → report → recheck.
5. **WP5** — fix pack + dashboard.
6. **WP6** — mobile companion (apply the M1 abort rule).
7. **WP7** — policy sandbox: edit, preview diff, version save.
8. **WP8** — polish, E2E, cloud deploy, demo rehearsal.

## Documentation

- [`01_documents/BRD.md`](01_documents/BRD.md) — business case, evidence tiers, scope
- [`01_documents/PRD.md`](01_documents/PRD.md) — users, rules, exceptions, pass criteria
- [`01_documents/TRD.md`](01_documents/TRD.md) — architecture, determinism, security, build order
- [`03_qa/README.md`](03_qa/README.md) — how to run and read the QA phase
- [`03_qa/qa-report.md`](03_qa/qa-report.md) — results, defects, limitations, decisions
- [`05_demo/README.md`](05_demo/README.md) — mockup run steps, deep links, real-vs-mocked boundary