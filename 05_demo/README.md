# 05_demo — Delivery-layer web mockup

A presentable, end-to-end mockup of the ReadyFile web application (TRD §5 screens,
§12 roles). **No backend.** The twist: the completeness results are not faked —
the real `@readyfile/rules-engine` from `02_source/` runs in the browser tab on
every check, so scores, statuses, reasons and fix packs are computed live from
seeded data, exactly as the engine unit tests define them.

> All borrower data is synthetic (BRD NFR-03, TRD SEC-01). No real PII, no file
> bytes — uploads capture metadata only.

## Run it

```bash
bash 05_demo/serve.sh          # serves the repo root on http://localhost:8000
# open http://localhost:8000/05_demo/
```

`PORT=9000 bash 05_demo/serve.sh` to use another port. Any static file server
works; Python 3 is the only requirement.

**Why a server is required:** the app uses native ES modules and an import map.
Browsers refuse module scripts over `file://`, so double-clicking `index.html`
will not work. There is no build step and no bundler.

## Presenter deep-links

Append `?as=<role>` to skip the login picker (role is stored for the session):

| URL | Screen |
| --- | --- |
| `?as=officer#/applications` | Pipeline — blocked files sort first (PC-05) |
| `?as=officer#/applications/RF-2401` | The demo spine: score 60, 2 blockers |
| `?as=officer#/applications/RF-2406` | Warnings-only file + acknowledge flow |
| `?as=officer#/applications/new` | Intake form (decision date = submission + 5 days) |
| `?as=officer#/applications/RF-2401/history` | Immutable check-run timeline |
| `?as=manager#/rules` | Active rule sets, versioned |
| `?as=manager#/rules/preview` | Rule sandbox — side-by-side impact before save |
| `?as=auditor#/applications/RF-2401/audit` | Append-only audit trail |

Other routes: `#/login`, `#/applications/<id>/audit`. Unknown hashes fall back
to login; a signed-in user hitting `#/login` is redirected to the pipeline.

## Suggested demo flow (matches PRD §16)

1. Sign in as **Officer** → pipeline shows 3 incomplete / 1 warning / 3 ready.
2. Open **RF-2401** (Amara Okafor): score **60**, bank statement expired at the
   decision date, credit bureau report missing. Read the reason column — every
   verdict is phrased for a borrower, with the rule id alongside.
3. In the upload panel, attach **bank statement v2** (issue 2026-03-04) and
   **credit bureau report v1** (issue 2026-03-05) — the fix pack tells you the
   exact dates needed. Re-run check → score **100**, Decision-ready.
4. Open **RF-2406**: warning-only. Acknowledge → promotes to Decision-ready
   (acknowledging never clears a blocker — try it on RF-2401 first).
5. Switch to **Manager** → Rule sandbox: drop bank-statement max age from 30 to
   25 days, watch RF-2401 flip back to Incomplete in the preview, save as v2.
   Officers see the same sandbox but the save button is hidden, not disabled.
6. Switch to **Auditor** → audit trail shows every action with actor, role and
   rule version. Underwriter and auditor navs hide what they cannot do.

## What is real vs mocked

| Real | Mocked |
| --- | --- |
| Engine evaluation (vendored ESM build of `02_source/packages`) | Persistence — `sessionStorage` only, per tab |
| Rule validation on save (`RuleSetSchema.safeParse`) | Auth — role picker, no credentials |
| Role/capability matrix (TRD §12.1, verbatim in seed) | Uploads — metadata form, no file bytes |
| Immutable check runs (rule version + document-id snapshot) | Rule saves — session-local, never mutate seed |
| Audit events (TRD §12.2 names) | Latency — measured in-tab via `performance.now()` |
| CSV export with formula-injection guard (PC-16) | Multi-user — one session per tab |

**Reset data** (top right) clears the session and reseeds from `seed.json`.

## Seed data

`seed.ts` is a deterministic, data-only generator (no results baked in):

- 7 applications across 3 products; 39 document versions; 3 rule sets (v1).
- **RF-2401** — the intake→fix spine (PRD §16 steps 2→8): 60 → 100.
- **RF-2404** — reproduces open defect **DEF-06** (payslips demanded from a
  self-employed home-loan applicant; score 88, gate closed).
- **RF-2407** — reproduces open defect **DEF-07** (future-dated bank statement
  accepted as valid; the upload form shows the amber notice).
- **RF-2406** — statement inside the 7-day warning window at decision date.

Regenerate after editing `seed.ts` (run from `02_source/` so tsx resolves):

```bash
cd 02_source && node --import tsx ../05_demo/seed.ts
```

## Rebuilding the vendored engine

`vendor/` holds plain-ESM emit of `@readyfile/core` + `@readyfile/rules-engine`
(`tsc` with `rewriteRelativeImportExtensions`) and zod's self-contained ESM tree
(MIT, license included). The import map in `index.html` resolves the bare
specifiers. After changing engine source:

```bash
bash 05_demo/rebuild-vendor.sh
```

## Verification done

- All flows exercised in a real browser: intake create → check 0 → validation
  reject → upload → 20; RF-2401 60→100; acknowledge promotion; sandbox
  preview/save with role gating; underwriter/auditor hidden actions; history
  replay; CSV export guard.
- All nine screens screenshot-reviewed at 1440px (headless Chrome).
- `node --check` on `app.js`; engine parity with `03_qa` fixtures (same rule
  sets, same expected scores).

## Known limits

- Session state dies with the tab; two tabs do not share data.
- The sandbox "save" is session-local (WP7 persistence is unbuilt).
- Mobile layout is responsive but the demo is designed for a laptop projector.