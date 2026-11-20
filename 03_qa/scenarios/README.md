# User test scenarios

Manual, human-executed scenario scripts. Three sets, 56 scenarios.

| Set | File | Scenarios | Source | Method | Status |
| --- | --- | --- | --- | --- | --- |
| S1 | [`demo-rehearsal.md`](demo-rehearsal.md) | SC-01 … SC-12 | PRD §16 demo story; TRD §12.1 access-control demo | `M` | 0 pass · 6 partial · 6 blocked |
| S2 | [`exception-scenarios.md`](exception-scenarios.md) | EX-01 … EX-24 | PRD §8.6 exception catalogue E-01 … E-24 | `M`, `I` | 2 automated · 11 partial · 11 blocked |
| S3 | [`role-access-scenarios.md`](role-access-scenarios.md) | AC-01 … AC-20 | TRD §12.1 access matrix, §12.2 audit spec; PRD PC-32…PC-35 | `I`, `M` | 0 pass · 0 partial · 20 blocked |

## Why so little is executable

These scenarios are written against the product as **specified**, not as built.
The repository currently contains two TypeScript packages — `@readyfile/core` and
`@readyfile/rules-engine` — and nothing else. There is no API, no database, no
web UI, no mobile app, no authentication, no audit log, no file upload and no
seeded demo data.

PRD §17 assigns each acceptance criterion a method: `U` unit · `I` API
integration · `E` Playwright E2E · `M` manual rehearsal · `G` golden file. Of the
47 release-gate criteria, the `U` and `G` ones can be attempted today. Every `I`,
`E` and `M` criterion is blocked, and so is every scenario that depends on one.

That is recorded rather than papered over: a scenario marked 🟢 PASS that was
never executed would be worse than no scenario document at all.

## How to use these files

- **Before a demo**, walk S1 top to bottom. Each scenario states the exact numbers
  the engine produces, so a rehearsal that shows a different number is a defect.
- **When a work package lands**, flip the scenarios it unblocks. WP3 (API)
  unblocks most of S2's server-detected rows and all of S3. WP4 (web) unblocks
  S1. WP5 (fix pack + sandbox) unblocks SC-06 and SC-10. WP1 (Prisma + seed +
  auth) unblocks AC-01…AC-15.
- **Automated cover** in each scenario points at the test that already proves the
  underlying logic, so a blocked scenario is not an untested one.

## Relationship to the automated suite

`../automated/` tests the engine and schema boundary directly and needs no
browser, database or server. There is no CI pipeline yet (see `../qa-report.md`
KL-09); today these suites run on a developer machine via `npm run verify`.
These scenarios test the product. The two overlap deliberately: where a scenario
is blocked, its `Automated cover` row says which part of it is nevertheless under
test.

Run the automated suites from `02_source/`:

```
npm run test        # engine unit matrix (TRD §15.1)
npm run test:qa     # acceptance suite (PRD §17 criteria)
npm run verify      # typecheck both, then run both
```
