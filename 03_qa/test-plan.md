# ReadyFile QA test plan

**Version:** 1.0 · **Date:** 2026-11-21 · **Author:** QA (automated)
**Governing documents:** PRD v1.3 §17 (acceptance criteria), TRD v1.2 §15 (testing and quality requirements), BRD v1.2 §6.2 (rule evidence)

---

## 1. Purpose

This plan says what is tested, at which level, with what tooling, and what has to
be true before the MVP can be called done. It exists because PRD §17 was rewritten
to make every criterion measurable — a measurable criterion that nobody has
assigned to a test layer is still untested.

The plan is deliberately honest about scope. Most of PRD §17 cannot be executed
today, and this document says so per criterion rather than reporting a green
suite that quietly covers a tenth of the requirements.

## 2. Scope

### In scope for this phase

| Component | Package | Status |
| --- | --- | --- |
| Shared vocabulary, date arithmetic, SLA calculator | `@readyfile/core` | Built |
| Rule-set schema (the author → engine gate) | `@readyfile/core` | Built |
| Deterministic completeness engine | `@readyfile/rules-engine` | Built |
| Borrower-facing reason and next-action wording | `@readyfile/rules-engine` | Built |

### Out of scope because it does not exist

Fastify API · Prisma schema and migrations · SQLite/Postgres persistence · seed
script · JWT auth and the role→route authorization middleware · append-only
`audit_events` · fix-pack generator and CSV/PDF export · React web app (Vite) ·
React Native/Expo mobile app · document upload, storage driver and MIME sniffing ·
Docker Compose deployment · Playwright.

TRD §18 work packages WP1 (partially), WP3–WP8 are unbuilt. Everything PRD §17
assigns to method `I`, `E` or `M` depends on at least one of them.

## 3. Test levels

| Level | Where it lives | Runs against | Count today |
| --- | --- | --- | --- |
| **Unit — engine matrix** | `02_source/packages/rules-engine/test/engine.test.ts` | `evaluate`, one `describe` per TRD §15.1 row | 65 tests / 25 suites |
| **Acceptance — QA suite** | `03_qa/automated/*.test.ts` | Full product rule sets, the demo story, and the schema gate | 149 tests / 45 suites |
| **Static** | `03_qa/automated/replay-determinism.test.ts` | Engine and core *source text* (PC-29) | 3 tests |
| **API integration (`I`)** | — | Not built | 0 |
| **E2E (`E`)** | — | Not built | 0 |
| **Manual rehearsal (`M`)** | `03_qa/scenarios/` | 56 scenarios written, 0 executed | 0 |

### Why the QA suite does not import the engine's own fixtures

`03_qa/automated/fixtures.ts` rebuilds the rule sets and the demo application
from the **documents** — PRD §11, BRD §6.2, PRD §16 — rather than importing
`02_source/packages/rules-engine/test/`. An acceptance suite that reuses the
implementation's fixtures inherits every mistake baked into them and can only
ever agree with itself. Two independent transcriptions of the same table is what
makes the suite worth running.

This already paid for itself: the QA transcription surfaced **DEF-06** (Home Loan
payslips unconditionally required) which the unit matrix, built from a single
product, could not see.

## 4. Tooling

| Concern | Choice | Why |
| --- | --- | --- |
| Runner | Node built-in test runner (`node --import tsx --test`) | Zero extra dependency tree. Vitest was evaluated and dropped: npm 10.9.2 arborist crashed installing it, and the vite/tinypool tree it pulled carried advisories |
| TS execution | `tsx` | Node's native type stripping cannot load workspace TS packages through `node_modules` symlinks (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`) |
| Assertions | `node:assert/strict` | Strict by default; `deepEqual` is structural |
| Typecheck | `tsc --noEmit`, two projects | `02_source/tsconfig.json` and `03_qa/tsconfig.json`. `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `erasableSyntaxOnly` |
| Schema validation | zod 4 | Same library the engine trusts, so the QA suite attacks the real gate |
| Golden strings | Hardcoded literals in `golden-wording.test.ts` | Deriving expected text from the engine's own label tables would make the test tautological |
| Lint | **None configured** | PC-29 names a lint rule as one of its methods. Today the static check is a test, not a lint rule |
| Coverage | **Not measured** | No coverage tool installed. See §9 |

## 5. Commands

Run from `02_source/`:

```
npm test              # engine unit matrix (TRD §15.1)
npm run test:qa       # QA acceptance suite
npm run test:all      # both
npm run typecheck     # 02_source
npm run typecheck:qa  # 03_qa
npm run verify        # typecheck both, then run both
```

`03_qa` sits outside the npm workspace on purpose — QA should not be able to
reach implementation internals through a workspace link. Its `tsconfig.json`
points `typeRoots` at `../02_source/node_modules/@types` because the inherited
`types: ["node"]` cannot resolve otherwise.

## 6. Test data policy

**Synthetic only.** BRD NFR-03, TRD SEC-01 and PRD NFR-06 all require it, and
TRD §14.3 requires every seeded record to carry a synthetic marker checked by CI.

- No real borrower names, addresses, account numbers or documents anywhere in
  `03_qa/` or in test fixtures.
- Dates are chosen for arithmetic clarity, not realism: submission `2026-03-02`,
  decision `2026-03-07`, SLA 5 days.
- Files are never created. The engine takes `DocumentMeta` — id, type, dates,
  upload timestamp, version — and no test needs bytes.
- No credentials, tokens or environment values appear in any test or fixture.

**CI synthetic-marker check is not built.** That is a TRD §14.3 requirement with
no implementation and no test.

## 7. Entry and exit criteria

### Entry (met)

- Engine and core packages compile under `strict` with zero errors.
- Every TRD §15.1 unit-matrix row has a named `describe` block.
- Rule sets transcribed from PRD §11 / BRD §6.2 pass `RuleSetSchema`.
- `npm audit` reports 0 vulnerabilities.

### Exit — release gate (PRD §17: *"PC-01 … PC-47 all pass"*)

**Not met, and not meetable in the current state.** Of PRD's 47 release-gate criteria (PC-01…PC-47; PC-48/PC-49 are stretch and excluded):

| Status | Count | Meaning |
| --- | --- | --- |
| ✅ Pass | 8 | Verified at the layer the criterion names |
| 🟡 Partial | 12 | Engine/schema layer verified; the named `I`/`E`/`M` layer is not built |
| 🔴 Blocked | 27 | Not verifiable today |

The 8 that pass: PC-03, PC-06, PC-07, PC-08, PC-09, PC-19, PC-28, PC-29.
This phase also adds PC-10a (hard-expiry equality semantics), which passes; it is
not one of PRD's 47 and is not counted above.

Full per-criterion evidence in [`traceability.md`](traceability.md).

### Exit — what this phase *does* satisfy

- Every criterion whose method is `U` or `G` **and whose subject is the engine or
  the rule schema** passes. The single `U`-method criterion that does not is
  PC-16, whose subject is the fix-pack CSV writer — a function that does not
  exist yet.
- Zero failing tests. Zero type errors in either project.
- Every defect found is reproduced by a passing test and recorded in
  [`qa-report.md`](qa-report.md) rather than silently fixed.

## 8. Unblocking map — what each work package makes testable

| Work package (TRD §18) | Unblocks |
| --- | --- |
| WP1 remainder — Prisma schema, `audit_events`, seed script, Fastify skeleton, demo login, authZ + audit middleware | PC-31, PC-32, PC-33, PC-34, PC-35, PC-46, PC-47; scenarios AC-01…AC-15; exceptions E-09, E-11, E-14, E-17, E-22 |
| WP2 remainder — rule JSON for the demo products | PC-05 (needs the real seeded rule sets, not QA transcriptions) |
| WP3 — API | Every `I` criterion: PC-01, PC-02, PC-04, PC-10, PC-11…PC-16, PC-18, PC-21…PC-25 |
| WP4 — web | Every `E` criterion: PC-04, PC-20, PC-21, PC-26, PC-42; all of scenario set S1 |
| WP5 — fix pack and sandbox | PC-11…PC-16, PC-21…PC-27; scenarios SC-06, SC-10; exceptions E-20, E-23 |
| WP6 — mobile | PC-39; exception E-24; scenario AC-16 |
| WP7 — deployment | PC-37, PC-46 |
| WP8 — rehearsal | PC-27, PC-38, PC-40, PC-41; every `M` criterion |

The two cheapest blocked criteria are **PC-16** (CSV formula prefixing, method
`U` — a pure function, testable the moment the generator exists) and **PC-31**
(no UPDATE/DELETE against the immutable tables — a static grep once Prisma
lands).

## 9. Risks to the test effort

| Risk | Impact | Mitigation |
| --- | --- | --- |
| **A spec mis-read propagates into both the implementation and its tests** | High — already happened once during this build | The QA suite transcribes from the documents independently (§3). Every citation in `03_qa/` is verified against the file on disk, not against memory or editor snapshots |
| No coverage measurement | Medium — "149 passing" says nothing about untested branches | Install `c8` when WP3 lands; until then, traceability is by criterion, not by line |
| No lint rule for PC-29 | Low — the static test covers it, but a new file could reintroduce `Date.now()` between runs | The test scans the whole `src/` directory each run, so a new file is caught |
| Timing assertions are environment-sensitive | Medium — `rule-config-gate.test.ts` asserts a 100 ms bound against a 0.007 ms measurement | Bound set ~14,000× above the measured value so it fails on regression, not on a slow runner |
| Only two of three products are in the MVP seed (TRD §14.3 calls Home Loan *stretch*) | Low for the demo, high for correctness | QA fixtures build all three; DEF-06 lives in the stretch product, which lowers its demo severity but not its correctness severity |
| No CI | High — nothing runs these tests automatically | `npm run verify` is a single command; wiring it into a GitHub Action is a small task |

## 10. Responsibilities

| Activity | Owner |
| --- | --- |
| Unit matrix maintenance as engine behaviour changes | Implementer |
| QA acceptance suite, fixtures, traceability, defect register | QA |
| Manual rehearsal of scenario set S1 before the demo | Presenter |
| Deciding DEF-07 (where future-dated documents are rejected) and OQ-7 (EVL window) | Business / product owner |
| Flipping blocked criteria to pass as work packages land | Whoever lands the work package |

## 11. Related files

- [`README.md`](README.md) — how this folder is organised
- [`traceability.md`](traceability.md) — PC-01…PC-49 → test → status
- [`qa-report.md`](qa-report.md) — measured results, defect register, known limitations
- [`scenarios/`](scenarios/) — the 56 manual scenarios
- [`automated/`](automated/) — the acceptance suite
