# `03_qa/` — quality assurance

Test scenarios, automated acceptance tests, and the QA report for ReadyFile.

**Read [`qa-report.md`](qa-report.md) first.** It carries the verdict, the
measured numbers, the defect register and the known limitations. Everything else
in this folder is the evidence behind it.

## Contents

| Path | What it is |
| --- | --- |
| [`qa-report.md`](qa-report.md) | **Results, defects, known limitations.** Start here |
| [`test-plan.md`](test-plan.md) | Scope, test levels, tooling, entry/exit criteria, and the work-package → unblocking map |
| [`traceability.md`](traceability.md) | Every PRD §17 criterion, §9 requirement, §14 NFR, §8.6 exception and §5.3 handoff → the test that covers it → its status |
| [`automated/`](automated/) | The acceptance suite: 149 tests / 45 suites across 9 test files, plus `fixtures.ts` |
| [`scenarios/`](scenarios/) | 56 manual scenario scripts in three sets. Written, **none executed** — see [`scenarios/README.md`](scenarios/README.md) |
| [`tsconfig.json`](tsconfig.json) | Separate TypeScript project for the QA suite |

## The one structural decision worth knowing

`03_qa/` sits **outside** the npm workspace in `02_source/` and imports the
packages' **entry points by relative path**. It cannot reach implementation
internals, and it deliberately does not import the engine's own test fixtures —
it rebuilds the rule sets and the demo file from PRD §11, BRD §6.2 and PRD §16
instead.

Two independent transcriptions of the same table is what makes the suite worth
running. It already paid for itself: the QA transcription surfaced **DEF-06**, a
defect in the published Home Loan rule matrix that the unit matrix — built from a
single product — could not see.

## Running it

From `02_source/`:

```
npm test              # engine unit matrix (TRD §15.1) — 65 tests
npm run test:qa       # this folder's acceptance suite — 149 tests
npm run test:all      # both
npm run typecheck     # 02_source
npm run typecheck:qa  # 03_qa
npm run verify        # typecheck both, then run both
```

Node v23.11.0, npm 10.9.2. Runner is Node's built-in test runner via `tsx`;
there is no test framework dependency.

## Current status, in one line

The completeness engine is implemented, deterministic and covered by **214
passing tests with zero failures and zero type errors** — and PRD §17's release
gate is **8 of 47 criteria passed**, because the API, database, web app, mobile
app, authentication, audit log, seed data and fix-pack generator do not exist
yet. Three defects are open, one of which (**DEF-07**) defeats the decision-ready
gate.

## Test data

**Synthetic only.** No real borrower names, addresses, account numbers or
documents appear anywhere in this folder, and no file bytes are ever created — the
engine consumes `DocumentMeta` (id, type, dates, upload timestamp, version), so no
test needs a real document. No credentials, tokens or environment values appear in
any test or fixture.
