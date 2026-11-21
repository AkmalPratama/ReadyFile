# 04_presentation — ReadyFile hackathon deck

An 18-slide presentation of what was built, how it was built, what the outcome
actually is, and how the demo runs — including four slides of real screenshots
from the `05_demo` mockup walking the full user journey. Self-contained: one
HTML file plus local images, no build step, no dependencies, no network
access. A PDF export of the same deck is included for sharing and for venues
without a browser.

| File | What it is |
| --- | --- |
| `index.html` | The deck. Open it in any browser. |
| `ReadyFile-deck.pdf` | 18-page 16:9 export of `index.html`, generated with headless Chrome print. |
| `img/journey-*.png` | Six 2× screenshots captured from a clean `05_demo` officer → manager → auditor session. |

## Presenting

Open `index.html` (double-click, or `open 04_presentation/index.html`).

| Input | Action |
| --- | --- |
| `→` `↓` `Space` `PageDown` | Next slide |
| `←` `↑` `PageUp` | Previous slide |
| `Home` / `End` | First / last slide |
| Click left / right edge | Previous / next slide |
| `F` | Toggle fullscreen |
| `P` | Print dialog → save as PDF (18 pages, 16:9, no margins) |
| `#N` in the URL | Deep-link to slide N, e.g. `index.html#10` |

The stage is a fixed 1280×720 canvas scaled to fit the window, so layout is
identical on a laptop, a projector and the PDF. The progress bar, slide
counter and key hint are screen chrome only; they are hidden when printing.

To regenerate the PDF exactly as shipped:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=15000 \
  --print-to-pdf=04_presentation/ReadyFile-deck.pdf \
  "file://$PWD/04_presentation/index.html"
```

## Slide map

| # | Slide | Answers |
| --- | --- | --- |
| 1 | Cover — tagline and the freshness timeline | What is this? |
| 2 | The problem — five pain points, four costs | Why does it exist? |
| 3 | The pain is documented, not assumed — evidence KPIs with A/B/C tiers | Why believe the problem? |
| 4 | Everyone measures age at upload. We measure it at decision. — the 27 → 32 insight | What is the idea? |
| 5 | Three layers, in that order — what was built, with line counts | What we built |
| 6 | Spec → engine → independent verification — four phases, three commits | How we built it |
| 7 | How the engine decides — statuses, freshness, hard expiry, score, gate | How it works |
| 8 | Deterministic by construction — constraints and what they buy | Why this design |
| 9 | Measured, not claimed — tests, typecheck, audit, latency, with conditions | Outcome, measured |
| 10 | The honest scorecard — 47 gates, 16 Must-haves, 24 exceptions | Outcome, honestly |
| 11 | Three defects we published instead of hiding — DEF-07 / DEF-06 / DEF-08 | Outcome, defects |
| 12 | Three acts, eleven steps — the demo story with measured numbers | Demo flow |
| 13 | What can actually be demoed today — terminal + mockup vs needs WP3–WP7 | Demo flow, truthfully |
| 14 | Act one — the gate closes at the decision date (screenshot: RF-2401 score 60, INCOMPLETE) | Demo journey, detect |
| 15 | Act two — one fix pack, one recheck, gate open (screenshot: score 100, DECISION_READY) | Demo journey, fix |
| 16 | Warnings inform the decision. They never block it. (screenshot: RF-2406 acknowledgement) | Demo journey, warnings |
| 17 | Act three — preview policy, then prove every action (screenshots: rule sandbox + audit trail) | Demo journey, govern |
| 18 | Closing — done / next / needs a decision | Where to go from here |

Suggested talk track: 1–4 problem and insight (3 min), 5–8 what and how
(3 min), 9–11 outcome (3 min), 12–17 demo story then the screenshot journey
(4 min), 18 ask (1 min).

## Where every number comes from

Nothing on a slide is invented. Each slide carries a `Source:` line; the
underlying artefacts are:

- `01_documents/BRD.md` v1.2 — pain points, evidence tiers, competitive
  entries CE-1/CE-2, open question OQ-B3.
- `01_documents/PRD.md` v1.3 — rule sets §11, engine semantics §10, demo
  story §16, pass criteria §17.
- `01_documents/TRD.md` v1.2 — determinism §7.3, build order §18.
- `03_qa/qa-report.md` — measured results §2, coverage §3, defect register
  §5, known limitations §6, open decisions §7.
- `03_qa/traceability.md` — the 47-gate tally, counted row by row.
- `git log` — commits `fd26d00`, `a3727e0`, `de677b6`, `562011b` (mockup).
- `05_demo/README.md` — verification notes behind the journey screenshots
  on slides 14–17; the numbers there were measured in-tab, not estimated.
- Latency and re-run figures were measured on this machine (Node v23.11.0,
  darwin arm64) at commit `de677b6`; slide 9 states the conditions and the
  two limits (no coverage tool, no CI) next to the numbers.

## What the deck deliberately does not claim

- No production web or mobile app. Slides 13–17 are honest about the split:
  the `05_demo` mockup **can be clicked through** with the real engine
  in-tab, but it is plain ESM with `sessionStorage`, a role picker instead
  of auth, metadata-only uploads and no durable backend. Presenting it as
  the production app would be a claim the repository does not support.
- The release gate is **not met**: 8 of 47 criteria pass, 12 partial, 27
  blocked. Blocked is shown as blocked, never as passed.
- The 56 manual scenarios are written, **none executed**.
- Tier-C benchmark figures are labelled as external benchmarks, and the
  BRD's forbidden-as-fact abandonment percentages are not on any slide.
- OQ-B3 (no live lender pipeline yet) is disclosed on the evidence slide.
- DEF-07, DEF-06 and DEF-08 are presented as open defects with reproductions,
  not as fixed.

## Verification performed

All 18 slides were rendered at 1280×720 with headless Chrome and inspected
visually; layout defects found in that pass (phase-card grid collision,
engine-logic panel overflow, KPI unit wrap, slide-13 callout overlap) were
fixed and re-rendered. The PDF export was checked to contain exactly 18
pages at 960×540 pt (16:9).

The six journey screenshots were captured from a clean seeded `05_demo`
session driven end-to-end over the Chrome DevTools Protocol: officer login →
pipeline → RF-2401 detection (score 60, INCOMPLETE) → two replacement
uploads → recheck (score 100, DECISION_READY, 0.1 ms) → RF-2406 warning
acknowledgement → manager rule preview (30 → 20 days, 1 of 4 files change,
unsaved) → auditor trail. The session's audit events were dumped and checked
against what the slides claim before the images were placed.