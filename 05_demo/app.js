/**
 * ReadyFile delivery-layer mockup.
 *
 * The UI is a mockup (no backend, no persistence beyond this browser session),
 * but every score, status, reason and fix-pack line is computed live by the
 * real @readyfile/rules-engine running in the browser from ./vendor.
 */
import { evaluate } from './vendor/rules-engine/src/index.js';
import {
  DATE_PROVENANCE_OFFICER_ENTRY,
  DOCUMENT_LABELS,
  ItemStatus,
  OverallStatus,
  RuleSetSchema,
  addDays,
} from './vendor/core/src/index.js';

const seed = await (await fetch('./seed.json')).json();
const KEY = 'readyfile-demo-session-v1';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const KNOWN_DEFECTS = { 'RF-2404': 'DEF-06', 'RF-2407': 'DEF-07' };

function fresh() {
  return {
    user: null,
    apps: structuredClone(seed.applications),
    versions: Object.fromEntries(seed.products.map((p) => [p.id, [p.rule_set]])),
    active: Object.fromEntries(seed.products.map((p) => [p.id, 1])),
    acks: {},
    viewRun: {},
    productAudit: [],
    globalAudit: [],
    seq: 2408,
    ui: { status: 'all', product: 'all', q: '', fixWarnings: false, ruleProduct: seed.products[0].id, draft: null, uploadFor: null, uploadErr: null, running: null },
  };
}

function load() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && s.apps && s.versions ? s : null;
  } catch {
    return null;
  }
}

let S = load() || fresh();
const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(S)); } catch { /* private mode */ } };

// Presenter deep-link: ?as=manager signs straight in as that demo role.
const asRole = new URLSearchParams(location.search).get('as');
if (!S.user && asRole && seed.users.some((u) => u.role === asRole)) {
  S.user = seed.users.find((u) => u.role === asRole);
  save();
}

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};
const fmtMoney = (n) => '$' + Number(n).toLocaleString('en-US');
const fmtAt = (iso) => iso.replace('T', ' ').replace('.000Z', ' UTC').slice(0, 22);

const STATUS_META = {
  PRESENT_VALID: { cls: 'ok', ic: '●', label: 'Present · valid' },
  EXPIRING_SOON: { cls: 'warn', ic: '▲', label: 'Expiring soon' },
  EXPIRED: { cls: 'bad', ic: '■', label: 'Expired' },
  MISSING: { cls: 'bad', ic: '■', label: 'Missing' },
  NOT_APPLICABLE: { cls: 'na', ic: '○', label: 'Not applicable' },
};
const OVERALL_META = {
  INCOMPLETE: { cls: 'bad', ic: '■', label: 'Incomplete' },
  COMPLETE_WITH_WARNINGS: { cls: 'warn', ic: '▲', label: 'Complete with warnings' },
  DECISION_READY: { cls: 'ok', ic: '●', label: 'Decision-ready' },
};
const statusChip = (s) => {
  const m = STATUS_META[s] || STATUS_META.NOT_APPLICABLE;
  return `<span class="status ${m.cls}"><span class="ic">${m.ic}</span>${m.label}</span>`;
};
const overallChip = (s) => {
  const m = OVERALL_META[s];
  return `<span class="status ${m.cls}"><span class="ic">${m.ic}</span>${m.label}</span>`;
};

const can = (cap) => !!S.user && (seed.permissions[cap] || []).includes(S.user.role);
const product = (id) => seed.products.find((p) => p.id === id);
const appById = (id) => S.apps.find((a) => a.id === id);
const ruleSet = (pid, v) => S.versions[pid].find((r) => r.version === v);
const activeSet = (pid) => ruleSet(pid, S.active[pid]);
const latestRun = (app) => app.runs[app.runs.length - 1] || null;
const shownRun = (app) => app.runs.find((r) => r.id === S.viewRun[app.id]) || latestRun(app);

function evaluateRun(app, run, rules = ruleSet(app.product_id, run.rule_version)) {
  return evaluate({
    application: {
      submissionDate: app.submission_date,
      expectedDecisionDate: app.expected_decision_date,
      attributes: app.attributes,
    },
    documents: app.documents.filter((d) => run.document_ids.includes(d.id)),
    rules,
    warningsAcknowledged: run.warnings_acknowledged || !!S.acks[run.id],
  });
}
const resultOf = (app) => {
  const run = latestRun(app);
  return run ? evaluateRun(app, run) : null;
};

function audit(app, event, detail) {
  app.audit.push({ at: new Date().toISOString(), actor: S.user.email, actor_role: S.user.role, event, detail });
}
function globalAudit(event, detail) {
  S.globalAudit.push({ at: new Date().toISOString(), actor: S.user ? S.user.email : 'anonymous', actor_role: S.user ? S.user.role : '—', event, detail });
}

function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

/* ---------------------------------------------------------------- routing */

function route() {
  const h = (location.hash || '#/login').replace(/^#/, '');
  const parts = h.split('/').filter(Boolean);
  if (parts[0] === 'applications' && parts[1] === 'new') return { name: 'intake' };
  if (parts[0] === 'applications' && parts[1] && parts[2] === 'history') return { name: 'history', id: parts[1] };
  if (parts[0] === 'applications' && parts[1] && parts[2] === 'audit') return { name: 'audit', id: parts[1] };
  if (parts[0] === 'applications' && parts[1]) return { name: 'detail', id: parts[1] };
  if (parts[0] === 'applications') return { name: 'dashboard' };
  if (parts[0] === 'rules' && parts[1] === 'preview') return { name: 'sandbox' };
  if (parts[0] === 'rules') return { name: 'rules' };
  return { name: 'login' };
}

const TITLES = {
  login: ['Sign in', 'Demo login'],
  dashboard: ['Pipeline', 'Applications'],
  intake: ['New application', 'Intake'],
  detail: ['Application', 'Report'],
  history: ['Check-run history', 'Timeline'],
  audit: ['Audit trail', 'Append-only'],
  rules: ['Rule sets', 'Policy'],
  sandbox: ['Rule sandbox', 'Preview before save'],
};

function render() {
  const r = route();
  const root = document.getElementById('app');
  if (!S.user && r.name !== 'login') { location.hash = '#/login'; return; }
  if (S.user && r.name === 'login') { location.hash = '#/applications'; return; }
  if (r.name === 'login') { root.innerHTML = viewLogin(); return; }
  const [title, crumb] = TITLES[r.name];
  root.innerHTML = `
  <div class="shell">
    <aside class="side">
      <div class="brand">Ready<span>File</span></div>
      <div class="tagline">Know at intake. Decide on time.</div>
      <nav>
        <a href="#/applications" class="${r.name === 'dashboard' || r.name === 'detail' || r.name === 'history' || r.name === 'audit' ? 'on' : ''}">Pipeline</a>
        ${can('create_application') ? `<a href="#/applications/new" class="${r.name === 'intake' ? 'on' : ''}">New application</a>` : ''}
        ${can('view_rules') ? `<a href="#/rules" class="${r.name === 'rules' ? 'on' : ''}">Rule sets</a>` : ''}
        ${can('preview_rules') ? `<a href="#/rules/preview" class="${r.name === 'sandbox' ? 'on' : ''}">Rule sandbox</a>` : ''}
      </nav>
      <div class="foot">
        <b>Delivery-layer mockup.</b> No backend: the real completeness engine runs in this browser tab; data is seeded and synthetic. Session state lives in sessionStorage only.
      </div>
    </aside>
    <div class="main">
      <header class="top">
        <div>
          <div class="crumb">${esc(crumb)}</div>
          <h1>${esc(title)}${r.id ? ' · ' + esc(r.id) : ''}</h1>
        </div>
        <div class="spacer"></div>
        <span class="mockbadge">Mockup · no backend</span>
        <div class="rolechip">
          <span>Signed in as</span>
          <select id="role-switch" aria-label="Switch demo user">
            ${seed.users.map((u) => `<option value="${u.role}" ${u.role === S.user.role ? 'selected' : ''}>${esc(u.name)} · ${u.role}</option>`).join('')}
          </select>
          <button class="btn small ghost" data-action="logout">Sign out</button>
          <button class="btn small ghost" data-action="reset-demo" title="Restore the seeded data">Reset data</button>
        </div>
      </header>
      <div class="content">${view(r)}</div>
    </div>
  </div>`;
}

function view(r) {
  switch (r.name) {
    case 'dashboard': return viewDashboard();
    case 'intake': return viewIntake();
    case 'detail': return viewDetail(appById(r.id));
    case 'history': return viewHistory(appById(r.id));
    case 'audit': return viewAudit(appById(r.id));
    case 'rules': return viewRules();
    case 'sandbox': return viewSandbox();
    default: return '<div class="empty">Unknown route.</div>';
  }
}

/* ------------------------------------------------------------------ login */

function viewLogin() {
  const blurbs = {
    officer: 'Upload, run checks, acknowledge warnings, generate fix packs. Preview rules but never save them.',
    manager: 'Everything an officer can do, plus save rule versions and read the full audit trail.',
    underwriter: 'Read-only on applications, reports and fix packs. Cannot upload, check or edit rules.',
    auditor: 'Read-only on everything, including rule versions and the complete audit trail.',
  };
  return `
  <div class="login">
    <div class="hero">Ready<span>File</span></div>
    <div class="sub">Loan document completeness, measured at the decision date. Pick a demo role to sign in — no credentials, no backend (TRD §12.1).</div>
    <div class="grid c2">
      ${seed.users.map((u) => `
        <button class="rolecard" data-action="login" data-role="${u.role}">
          <span class="r">${esc(u.role)}</span>
          <span class="e">${esc(u.email)}</span>
          <span class="d">${esc(blurbs[u.role])}</span>
        </button>`).join('')}
    </div>
    <p class="small faint" style="margin-top:18px">All borrower data is synthetic (BRD NFR-03, TRD SEC-01). Actions your role cannot perform are hidden, not disabled.</p>
  </div>`;
}

/* -------------------------------------------------------------- dashboard */

function viewDashboard() {
  const rows = S.apps.map((a) => ({ a, res: resultOf(a) }));
  const counts = {
    blocked: rows.filter((x) => x.res && x.res.overallStatus === OverallStatus.INCOMPLETE).length,
    warnings: rows.filter((x) => x.res && x.res.overallStatus === OverallStatus.COMPLETE_WITH_WARNINGS).length,
    ready: rows.filter((x) => x.res && x.res.overallStatus === OverallStatus.DECISION_READY).length,
    unchecked: rows.filter((x) => !x.res).length,
  };
  const q = S.ui.q.toLowerCase();
  const filtered = rows
    .filter((x) => S.ui.product === 'all' || x.a.product_id === S.ui.product)
    .filter((x) => {
      if (S.ui.status === 'all') return true;
      if (S.ui.status === 'unchecked') return !x.res;
      return x.res && x.res.overallStatus === S.ui.status;
    })
    .filter((x) => !q || (x.a.id + x.a.borrower + product(x.a.product_id).name).toLowerCase().includes(q))
    .sort((x, y) => {
      const bx = x.res ? x.res.blockingCount : -1;
      const by = y.res ? y.res.blockingCount : -1;
      if ((by > 0) !== (bx > 0)) return (by > 0) - (bx > 0);
      const sx = x.res ? x.res.score : 101;
      const sy = y.res ? y.res.score : 101;
      return sx - sy || x.a.id.localeCompare(y.a.id);
    });
  return `
  <div class="grid c4" style="margin-bottom:18px">
    <div class="kpi red"><div class="n">${counts.blocked}</div><div class="l">Incomplete — gate closed</div></div>
    <div class="kpi amber"><div class="n">${counts.warnings}</div><div class="l">Complete with warnings</div></div>
    <div class="kpi teal"><div class="n">${counts.ready}</div><div class="l">Decision-ready</div></div>
    <div class="kpi"><div class="n">${counts.unchecked}</div><div class="l">Not checked yet</div></div>
  </div>
  <div class="card">
    <h2>Pipeline <span class="hint">blocked files sort first (PC-05)</span></h2>
    <div class="row" style="margin-bottom:12px">
      <select id="filter-status" aria-label="Filter by status">
        <option value="all">All statuses</option>
        <option value="INCOMPLETE" ${S.ui.status === 'INCOMPLETE' ? 'selected' : ''}>Incomplete</option>
        <option value="COMPLETE_WITH_WARNINGS" ${S.ui.status === 'COMPLETE_WITH_WARNINGS' ? 'selected' : ''}>With warnings</option>
        <option value="DECISION_READY" ${S.ui.status === 'DECISION_READY' ? 'selected' : ''}>Decision-ready</option>
        <option value="unchecked" ${S.ui.status === 'unchecked' ? 'selected' : ''}>Not checked</option>
      </select>
      <select id="filter-product" aria-label="Filter by product">
        <option value="all">All products</option>
        ${seed.products.map((p) => `<option value="${p.id}" ${S.ui.product === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
      </select>
      <input id="filter-q" placeholder="Search ref or borrower" value="${esc(S.ui.q)}" style="border:1px solid var(--line);border-radius:8px;padding:8px 10px">
      <div class="spacer"></div>
      ${can('create_application') ? '<a class="btn primary" href="#/applications/new" style="text-decoration:none">New application</a>' : ''}
    </div>
    <table>
      <thead><tr><th>Ref</th><th>Borrower</th><th>Product</th><th class="num">Amount</th><th>Decision due</th><th class="num">Score</th><th>Status</th><th class="num">Blocking</th></tr></thead>
      <tbody>
        ${filtered.map(({ a, res }) => `
          <tr>
            <td><a href="#/applications/${a.id}" class="mono">${a.id}</a></td>
            <td>${esc(a.borrower)}${KNOWN_DEFECTS[a.id] ? ` <span class="chip defect">${KNOWN_DEFECTS[a.id]} open</span>` : ''}</td>
            <td class="muted">${esc(product(a.product_id).name)}</td>
            <td class="num">${fmtMoney(a.loan_amount)}</td>
            <td>${fmtDate(a.expected_decision_date)}</td>
            <td class="num"><b>${res ? res.score : '—'}</b></td>
            <td>${res ? overallChip(res.overallStatus) : '<span class="status info"><span class="ic">○</span>Not checked</span>'}</td>
            <td class="num">${res ? res.blockingCount : '—'}</td>
          </tr>`).join('') || '<tr><td colspan="8"><div class="empty">No applications match the filters.</div></td></tr>'}
      </tbody>
    </table>
  </div>`;
}

/* ----------------------------------------------------------------- intake */

function viewIntake() {
  const pid = S.ui.intakeProduct || seed.products[0].id;
  const sub = S.ui.intakeSubmission || '2026-03-02';
  const decision = /^\d{4}-\d{2}-\d{2}$/.test(sub) ? fmtDate(addDays(sub, seed.meta.processing_sla_days)) : '—';
  return `
  <div class="card" style="max-width:860px">
    <h2>Intake <span class="hint">expected decision date = submission + ${seed.meta.processing_sla_days} calendar days</span></h2>
    <form id="intake-form">
      <div class="formgrid">
        <div class="field"><label for="i-product">Product</label>
          <select id="i-product" name="product">${seed.products.map((p) => `<option value="${p.id}" ${p.id === pid ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="i-borrower">Borrower (synthetic)</label>
          <input id="i-borrower" name="borrower" value="${esc(S.ui.intakeBorrower || 'Synthetic Applicant')}" required></div>
        <div class="field"><label for="i-amount">Loan amount</label>
          <input id="i-amount" name="amount" type="number" min="1000" step="500" value="${S.ui.intakeAmount || 25000}" required></div>
        <div class="field"><label for="i-submission">Submission date</label>
          <input id="i-submission" name="submission" type="date" value="${sub}" required></div>
        <div class="field"><label>Expected decision date</label>
          <input value="${decision}" disabled></div>
        <div class="field"><label for="i-tenure">Tenure (months)</label>
          <input id="i-tenure" name="tenure" type="number" min="0" value="${S.ui.intakeTenure ?? 36}"></div>
        <div class="field"><label for="i-employment">Employment type</label>
          <select id="i-employment" name="employment"><option value="salaried">Salaried</option><option value="self_employed" ${S.ui.intakeEmployment === 'self_employed' ? 'selected' : ''}>Self-employed</option></select></div>
        ${pid === 'home_loan' ? `<div class="field"><label for="i-security">Security type</label>
          <select id="i-security" name="security"><option value="property">Property</option><option value="none">None</option></select></div>` : ''}
      </div>
      <div class="row end">
        <a class="btn ghost" href="#/applications" style="text-decoration:none">Cancel</a>
        <button class="btn primary" type="submit">Create application</button>
      </div>
    </form>
  </div>`;
}

/* ----------------------------------------------------------------- detail */

function viewDetail(app) {
  if (!app) return '<div class="empty">Application not found.</div>';
  const run = shownRun(app);
  const res = run ? evaluateRun(app, run) : null;
  const acked = run ? run.warnings_acknowledged || !!S.acks[run.id] : false;
  const banner = !res
    ? `<div class="banner info"><span class="ic">○</span><div><h3>No check run yet</h3><p>Upload documents and run the first completeness check.</p></div>${can('run_check') ? `<button class="btn primary" data-action="run-check" data-app="${app.id}">Run check</button>` : ''}</div>`
    : res.overallStatus === OverallStatus.INCOMPLETE
      ? `<div class="banner bad"><span class="ic">■</span><div><h3>Incomplete — decision-ready gate closed</h3><p>${res.blockingCount} required item${res.blockingCount === 1 ? '' : 's'} missing or expired at the expected decision date. Acknowledging warnings cannot clear a blocker.</p></div>${can('run_check') ? `<button class="btn primary" data-action="run-check" data-app="${app.id}">${S.ui.running === app.id ? '<span class="spinner"></span>Checking' : 'Run check'}</button>` : ''}</div>`
      : res.overallStatus === OverallStatus.COMPLETE_WITH_WARNINGS
        ? `<div class="banner warn"><span class="ic">▲</span><div><h3>Complete with warnings</h3><p>${res.warningCount} item${res.warningCount === 1 ? '' : 's'} inside the warning window at the decision date. Nothing blocks the decision.${acked ? ' Warnings acknowledged.' : ''}</p></div>${can('ack_warnings') && !acked ? `<button class="btn" data-action="ack" data-app="${app.id}">Acknowledge warnings</button>` : ''}${can('run_check') ? `<button class="btn primary" data-action="run-check" data-app="${app.id}">Run check</button>` : ''}</div>`
        : `<div class="banner ok"><span class="ic">●</span><div><h3>Decision-ready</h3><p>All applicable required documents are valid at the expected decision date (${fmtDate(app.expected_decision_date)}).</p></div>${can('run_check') ? `<button class="btn primary" data-action="run-check" data-app="${app.id}">Run check</button>` : ''}</div>`;

  const attrs = Object.entries(app.attributes).map(([k, v]) => `<span class="chip">${esc(k)}: ${esc(v)}</span>`).join('');
  const checklist = res ? `
    <table>
      <thead><tr><th>Document</th><th>Requirement</th><th class="num">Uploaded</th><th>Evaluated date</th><th>Status</th><th>Reason</th><th>Next action</th><th>Rule</th></tr></thead>
      <tbody>
        ${res.items.map((it) => {
          const doc = app.documents.find((d) => d.id === it.evaluatedDocumentId);
          const uploaded = app.documents.filter((d) => d.documentType === it.documentType && run.document_ids.includes(d.id)).length;
          const date = doc ? (doc.issueDate ? fmtDate(doc.issueDate) : fmtDate(doc.expiryDate) + (doc.issueDate ? '' : ' (expiry)')) : '—';
          return `<tr>
            <td><b>${esc(DOCUMENT_LABELS[it.documentType])}</b></td>
            <td class="muted">${esc(it.requirement)}</td>
            <td class="num">${uploaded}</td>
            <td>${date}</td>
            <td>${statusChip(it.status)}</td>
            <td class="muted">${esc(it.reasonText)}</td>
            <td class="muted">${esc(it.nextAction)}</td>
            <td class="mono faint">${esc(it.ruleId)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div class="provenance">${esc(DATE_PROVENANCE_OFFICER_ENTRY)} — the engine never reads dates from the file itself (PRD E-19 / PC-20).</div>`
    : '<div class="empty">Run a check to produce the checklist.</div>';

  const upload = can('upload_document') ? `
    <div class="card">
      <h2>Upload panel <span class="hint">metadata only — no file bytes leave this tab</span></h2>
      ${activeSet(app.product_id).items.map((rule) => {
        const attached = app.documents.filter((d) => d.documentType === rule.document_type);
        const open = S.ui.uploadFor === app.id + ':' + rule.rule_id;
        return `
        <div class="fixitem">
          <div class="h">${esc(DOCUMENT_LABELS[rule.document_type])} <span class="mono faint">${esc(rule.rule_id)}</span>
            <span class="spacer"></span>
            ${open ? '' : `<button class="btn small" data-action="attach-open" data-app="${app.id}" data-rule="${rule.rule_id}">Attach version ${attached.length + 1}</button>`}
          </div>
          ${attached.length ? `<p class="small muted">${attached.map((d) => `v${d.version} · issue ${fmtDate(d.issueDate)} · expiry ${fmtDate(d.expiryDate)}`).join(' &nbsp;|&nbsp; ')}</p>` : '<p class="small faint">Nothing uploaded.</p>'}
          ${open ? uploadForm(app, rule) : ''}
        </div>`;
      }).join('')}
    </div>` : '';

  const fix = can('view_fix_pack') && res ? fixPack(app, res) : '';

  return `
  ${banner}
  <div class="card">
    <h2>${esc(app.borrower)} ${KNOWN_DEFECTS[app.id] ? `<span class="chip defect">${KNOWN_DEFECTS[app.id]} open — reproduced on purpose, see 03_qa/qa-report.md</span>` : ''}</h2>
    <div class="row">
      <span class="chip">${esc(product(app.product_id).name)}</span>
      <span class="chip">${fmtMoney(app.loan_amount)}</span>
      <span class="chip">submitted ${fmtDate(app.submission_date)}</span>
      <span class="chip">decision due ${fmtDate(app.expected_decision_date)}</span>
      ${attrs}
    </div>
    <div class="row" style="margin-top:12px">
      <label class="small muted" for="run-select">Check run</label>
      <select id="run-select" data-app="${app.id}">
        ${app.runs.map((r) => `<option value="${r.id}" ${r.id === run?.id ? 'selected' : ''}>${esc(r.label)} · ${fmtAt(r.at)} · rule v${r.rule_version}</option>`).join('')}
      </select>
      <div class="spacer"></div>
      <a class="btn small" href="#/applications/${app.id}/history" style="text-decoration:none">History</a>
      ${can('view_audit') ? `<a class="btn small" href="#/applications/${app.id}/audit" style="text-decoration:none">Audit trail</a>` : ''}
    </div>
  </div>
  <div class="card"><h2>Checklist <span class="hint">score ${res ? res.score : '—'} · ${res ? res.validRequiredCount + '/' + res.applicableRequiredCount : '0/0'} required valid at decision</span></h2>${checklist}</div>
  ${upload}
  ${fix}`;
}

function uploadForm(app, rule) {
  const err = S.ui.uploadErr || {};
  const suggestion = (seed.demo_suggestions[app.id] || []).find((d) => d.documentType === rule.document_type);
  const issue = err.issue ?? (suggestion ? suggestion.issueDate : (rule.freshness ? addDays(app.expected_decision_date, -2) : ''));
  const expiry = err.expiry ?? (suggestion ? suggestion.expiryDate : (rule.hard_expiry ? addDays(app.submission_date, 730) : ''));
  return `
  <form id="upload-form" data-app="${app.id}" data-rule="${rule.rule_id}" style="margin-top:10px">
    <div class="formgrid">
      <div class="field"><label>File (simulated)</label><input value="${esc(rule.document_type)}-v${app.documents.filter((d) => d.documentType === rule.document_type).length + 1}.pdf" disabled></div>
      <div class="field"><label for="u-issue">Issue date ${rule.freshness ? '(required)' : '(optional)'}</label>
        <input id="u-issue" name="issue" type="date" value="${esc(issue)}">
        ${err.issueMsg ? `<span class="err">${esc(err.issueMsg)}</span>` : ''}</div>
      <div class="field"><label for="u-expiry">Expiry date ${rule.hard_expiry ? '(required)' : '(optional)'}</label>
        <input id="u-expiry" name="expiry" type="date" value="${esc(expiry)}">
        ${err.expiryMsg ? `<span class="err">${esc(err.expiryMsg)}</span>` : ''}</div>
    </div>
    ${err.future ? `<p class="small" style="color:var(--amber);margin-bottom:10px">Future-dated document: accepted pending the DEF-07 decision; the engine will treat it as valid.</p>` : ''}
    <div class="row end">
      <button class="btn ghost small" type="button" data-action="attach-cancel">Cancel</button>
      <button class="btn primary small" type="submit">Upload version</button>
    </div>
  </form>`;
}

function fixPack(app, res) {
  const entries = res.items.filter((it) =>
    it.status === ItemStatus.MISSING || it.status === ItemStatus.EXPIRED ||
    (S.ui.fixWarnings && it.status === ItemStatus.EXPIRING_SOON));
  return `
  <div class="card">
    <h2>Borrower fix pack <span class="hint">one consolidated request list (K4)</span></h2>
    <div class="row" style="margin-bottom:12px">
      <label class="toggle"><input type="checkbox" id="fix-warnings" ${S.ui.fixWarnings ? 'checked' : ''}> Include warnings</label>
      <div class="spacer"></div>
      ${can('export_fix_pack_csv') ? `<button class="btn small" data-action="csv" data-app="${app.id}">Export CSV</button>` : ''}
      <button class="btn small" data-action="copy" data-app="${app.id}">Copy as text</button>
    </div>
    ${entries.length ? entries.map((it, i) => `
      <div class="fixitem">
        <div class="h">${i + 1}. ${esc(DOCUMENT_LABELS[it.documentType])} ${statusChip(it.status)}</div>
        <p>${esc(it.reasonText)} ${esc(it.nextAction)}</p>
      </div>`).join('') : '<div class="empty">Nothing to request — the file is decision-ready.</div>'}
  </div>`;
}

/* ---------------------------------------------------------------- history */

function viewHistory(app) {
  if (!app) return '<div class="empty">Application not found.</div>';
  const runs = app.runs.slice().reverse();
  return `
  <div class="card">
    <h2>Check-run timeline <span class="hint">immutable runs · rule version recorded per run (PR-17, PC-30)</span></h2>
    ${runs.length ? `<ul class="timeline">
      ${runs.map((r) => {
        const res = evaluateRun(app, r);
        const m = OVERALL_META[res.overallStatus];
        return `<li class="${m.cls === 'ok' ? '' : m.cls}">
          <div class="t">${fmtAt(r.at)} · rule v${r.rule_version} · ${r.document_ids.length} document versions</div>
          <div class="h">${esc(r.label)} — score ${res.score} ${overallChip(res.overallStatus)}</div>
          <div class="small muted">blocking ${res.blockingCount} · warnings ${res.warningCount} · valid required ${res.validRequiredCount}/${res.applicableRequiredCount}${S.acks[r.id] ? ' · warnings acknowledged' : ''}</div>
          <div class="row" style="margin-top:6px"><a class="btn small" href="#/applications/${app.id}" data-action="view-run" data-app="${app.id}" data-run="${r.id}" style="text-decoration:none">View this run</a></div>
        </li>`;
      }).join('')}
    </ul>` : '<div class="empty">No checks have run yet.</div>'}
  </div>`;
}

/* ------------------------------------------------------------------ audit */

function viewAudit(app) {
  if (!app) return '<div class="empty">Application not found.</div>';
  if (!can('view_audit')) return '<div class="empty">Your role cannot view the audit trail (TRD §12.1).</div>';
  return `
  <div class="card">
    <h2>Audit trail <span class="hint">append-only · seeded events plus this session's actions</span></h2>
    <table>
      <thead><tr><th>When (UTC)</th><th>Actor</th><th>Role</th><th>Event</th><th>Detail</th></tr></thead>
      <tbody>
        ${app.audit.map((e) => `<tr>
          <td class="mono faint when">${fmtAt(e.at)}</td>
          <td class="mono">${esc(e.actor)}</td>
          <td>${esc(e.actor_role)}</td>
          <td class="mono">${esc(e.event)}</td>
          <td class="mono faint small audit-detail">${esc(JSON.stringify(e.detail))}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

/* ------------------------------------------------------------------ rules */

function viewRules() {
  const pid = S.ui.ruleProduct;
  const set = activeSet(pid);
  const versions = S.versions[pid];
  return `
  <div class="card">
    <h2>Active rule sets <span class="hint">immutable versions · an edit is a new version, never a mutation (TRD §7.6)</span></h2>
    <div class="row" style="margin-bottom:12px">
      ${seed.products.map((p) => `<button class="btn small ${p.id === pid ? 'primary' : ''}" data-action="rule-product" data-product="${p.id}">${esc(p.name)}</button>`).join('')}
      <div class="spacer"></div>
      ${can('preview_rules') ? '<a class="btn small" href="#/rules/preview" style="text-decoration:none">Open sandbox</a>' : ''}
    </div>
    <div class="row" style="margin-bottom:12px">
      ${versions.map((v) => `<span class="chip ${v.version === S.active[pid] ? 'defect' : ''}" style="${v.version === S.active[pid] ? 'background:var(--teal-bg);color:var(--teal-ink)' : ''}">v${v.version}${v.version === S.active[pid] ? ' · active' : ''}${v.version > 1 ? ' · saved this session' : ' · seed'}</span>`).join('')}
      <span class="chip">warning horizon ${set.warning_horizon_days} days</span>
    </div>
    <table>
      <thead><tr><th>Rule</th><th>Document</th><th>Requirement</th><th>Condition</th><th>Max age</th><th>Hard expiry</th></tr></thead>
      <tbody>
        ${set.items.map((it) => `<tr>
          <td class="mono">${esc(it.rule_id)}</td>
          <td>${esc(DOCUMENT_LABELS[it.document_type])}</td>
          <td class="muted">${esc(it.requirement)}</td>
          <td class="mono faint">${it.condition ? esc(`${it.condition.field} ${it.condition.op} ${it.condition.value}`) : '—'}</td>
          <td class="num">${it.freshness ? it.freshness.max_age_days + ' days' : '—'}</td>
          <td>${it.hard_expiry ? 'yes' : 'no'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>
  ${S.productAudit.length ? `
  <div class="card">
    <h2>Rule-change audit <span class="hint">this session</span></h2>
    <table>
      <thead><tr><th>When (UTC)</th><th>Actor</th><th>Event</th><th>Detail</th></tr></thead>
      <tbody>${S.productAudit.map((e) => `<tr><td class="mono faint when">${fmtAt(e.at)}</td><td class="mono">${esc(e.actor)}</td><td class="mono">${esc(e.event)}</td><td class="mono faint small audit-detail">${esc(JSON.stringify(e.detail))}</td></tr>`).join('')}</tbody>
    </table>
  </div>` : ''}`;
}

/* ---------------------------------------------------------------- sandbox */

function draftSet() {
  const pid = S.ui.ruleProduct;
  const base = activeSet(pid);
  if (!S.ui.draft || S.ui.draft.product_id !== pid) {
    S.ui.draft = {
      product_id: pid,
      version: Math.max(...S.versions[pid].map((v) => v.version)) + 1,
      warning_horizon_days: base.warning_horizon_days,
      ages: Object.fromEntries(base.items.filter((i) => i.freshness).map((i) => [i.rule_id, i.freshness.max_age_days])),
    };
  }
  const d = S.ui.draft;
  return {
    product_id: pid,
    version: d.version,
    warning_horizon_days: d.warning_horizon_days,
    items: base.items.map((it) => it.freshness ? { ...it, freshness: { kind: 'max_age', max_age_days: d.ages[it.rule_id] } } : it),
  };
}

function viewSandbox() {
  const pid = S.ui.ruleProduct;
  const draft = draftSet();
  const parsed = RuleSetSchema.safeParse(draft);
  const apps = S.apps.filter((a) => a.product_id === pid && latestRun(a));
  const rows = apps.map((a) => {
    const run = latestRun(a);
    const cur = evaluateRun(a, run);
    const next = parsed.success ? evaluateRun(a, run, parsed.data) : null;
    return { a, cur, next };
  });
  const changed = rows.filter((r) => r.next && (r.next.score !== r.cur.score || r.next.overallStatus !== r.cur.overallStatus)).length;
  return `
  <div class="card">
    <h2>Draft rule version <span class="hint">v${draft.version} · preview runs the real engine on both versions</span></h2>
    <div class="row" style="margin-bottom:12px">
      ${seed.products.map((p) => `<button class="btn small ${p.id === pid ? 'primary' : ''}" data-action="rule-product" data-product="${p.id}">${esc(p.name)}</button>`).join('')}
    </div>
    <div class="formgrid">
      ${activeSet(pid).items.filter((i) => i.freshness).map((it) => `
        <div class="field"><label for="d-${it.rule_id}">${esc(it.rule_id)} · ${esc(DOCUMENT_LABELS[it.document_type])} max age (days)</label>
          <input id="d-${it.rule_id}" data-sandbox-age="${it.rule_id}" type="number" min="0" max="3650" value="${S.ui.draft.ages[it.rule_id]}"></div>`).join('')}
      <div class="field"><label for="d-horizon">Warning horizon (days)</label>
        <input id="d-horizon" data-sandbox-horizon type="number" min="0" max="90" value="${S.ui.draft.warning_horizon_days}"></div>
    </div>
    ${parsed.success ? '' : `<div class="banner bad" style="margin:0 0 12px"><span class="ic">■</span><div><h3>Draft rejected by RuleSetSchema</h3><p class="mono small">${esc(parsed.error.issues.map((i) => i.path.join('.') + ': ' + i.message).join(' · '))}</p></div></div>`}
    <div class="row end">
      ${can('save_rules')
        ? `<button class="btn primary" data-action="save-rules" ${parsed.success ? '' : 'disabled'}>Save as version ${draft.version}</button>`
        : '<span class="small muted">Your role can preview but not save rule versions (TRD §12.1).</span>'}
    </div>
  </div>
  <div class="card">
    <h2>Impact on seeded applications <span class="hint">${changed} of ${rows.length} files change · side-by-side before saving (PC-21…PC-27)</span></h2>
    <table>
      <thead><tr><th>Application</th><th>Current v${S.active[pid]}</th><th>Draft v${draft.version}</th><th>Change</th></tr></thead>
      <tbody>
        ${rows.map(({ a, cur, next }) => `
          <tr class="${next && (next.score !== cur.score || next.overallStatus !== cur.overallStatus) ? 'changed' : ''}">
            <td><a href="#/applications/${a.id}" class="mono">${a.id}</a> <span class="muted">${esc(a.borrower)}</span></td>
            <td>score <b>${cur.score}</b> ${overallChip(cur.overallStatus)} <span class="small muted">blocking ${cur.blockingCount}</span></td>
            <td>${next ? `score <b>${next.score}</b> ${overallChip(next.overallStatus)} <span class="small muted">blocking ${next.blockingCount}</span>` : '<span class="faint">draft invalid</span>'}</td>
            <td class="small">${next ? (next.score !== cur.score || next.overallStatus !== cur.overallStatus ? `score ${cur.score} → ${next.score}` : 'no change') : '—'}</td>
          </tr>`).join('')}
      </tbody>
    </table>
    <p class="small faint" style="margin-top:10px">Saving stores the new version in this browser session only. There is no backend persistence yet (WP7 unbuilt); the mockup never mutates an existing version.</p>
  </div>`;
}

/* ---------------------------------------------------------------- actions */

function fixPackText(app, res) {
  const entries = res.items.filter((it) =>
    it.status === ItemStatus.MISSING || it.status === ItemStatus.EXPIRED ||
    (S.ui.fixWarnings && it.status === ItemStatus.EXPIRING_SOON));
  const lines = entries.map((it, i) => `${i + 1}. ${DOCUMENT_LABELS[it.documentType]} — ${it.reasonText} ${it.nextAction}`);
  return `ReadyFile fix pack — ${app.id} (${app.borrower})\nDecision due ${fmtDate(app.expected_decision_date)}\n\n${lines.join('\n') || 'Nothing to request.'}\n`;
}

const csvCell = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
};

function exportCsv(app, res) {
  const entries = res.items.filter((it) =>
    it.status === ItemStatus.MISSING || it.status === ItemStatus.EXPIRED ||
    (S.ui.fixWarnings && it.status === ItemStatus.EXPIRING_SOON));
  const head = ['rule_id', 'document_type', 'status', 'reason', 'next_action'];
  const body = entries.map((it) => [it.ruleId, it.documentType, it.status, it.reasonText, it.nextAction]);
  const csv = [head, ...body].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${app.id}-fix-pack.csv`;
  a.click();
  URL.revokeObjectURL(url);
  audit(app, 'FIX_PACK_EXPORTED', { format: 'csv', entry_count: entries.length });
  toast(`CSV exported with ${entries.length} entries. Formula-leading cells are prefixed (PC-16).`);
}

async function copyText(app, res) {
  const text = fixPackText(app, res);
  try {
    await navigator.clipboard.writeText(text);
    toast('Fix pack copied to clipboard.');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    toast('Fix pack copied to clipboard.');
  }
  audit(app, 'FIX_PACK_GENERATED', { entry_count: text.split('\n').length, include_warnings: S.ui.fixWarnings });
}

function runCheck(app) {
  S.ui.running = app.id;
  render();
  setTimeout(() => {
    const t0 = performance.now();
    const run = {
      id: `run-${app.id}-${app.runs.length + 1}`,
      label: 'Officer check',
      at: new Date().toISOString(),
      rule_version: S.active[app.product_id],
      document_ids: app.documents.map((d) => d.id),
      warnings_acknowledged: false,
    };
    const res = evaluateRun(app, run);
    const ms = performance.now() - t0;
    app.runs.push(run);
    S.viewRun[app.id] = run.id;
    audit(app, 'CHECK_RUN', {
      rule_version_id: run.rule_version,
      engine_version: seed.meta.engine_version,
      expected_decision_date: app.expected_decision_date,
      score: res.score,
      overall_status: res.overallStatus,
      in_browser_ms: Number(ms.toFixed(3)),
    });
    S.ui.running = null;
    save();
    render();
    toast(`Check complete: score ${res.score}, ${res.overallStatus}. Engine took ${ms.toFixed(2)} ms in this browser.`);
  }, 260);
}

function submitUpload(form) {
  const app = appById(form.dataset.app);
  const rule = activeSet(app.product_id).items.find((i) => i.rule_id === form.dataset.rule);
  const issue = form.issue.value || null;
  const expiry = form.expiry.value || null;
  const err = {};
  if (rule.freshness && !issue) err.issueMsg = 'Issue date is required for a freshness rule (PRD E-05).';
  if (rule.hard_expiry && !expiry) err.expiryMsg = 'Expiry date is required for a hard-expiry rule (PRD E-06).';
  if (issue && expiry && expiry <= issue) err.expiryMsg = 'Expiry must be after the issue date.';
  if (issue && issue > app.submission_date) err.future = true;
  if (err.issueMsg || err.expiryMsg) {
    S.ui.uploadErr = { ...err, issue, expiry };
    audit(app, 'DOCUMENT_REJECTED', { reason_code: 'CLIENT_VALIDATION', document_type: rule.document_type });
    save(); render();
    return;
  }
  const version = Math.max(0, ...app.documents.filter((d) => d.documentType === rule.document_type).map((d) => d.version)) + 1;
  const doc = {
    id: `${app.id}-u${S.seq++}`,
    documentType: rule.document_type,
    issueDate: issue,
    expiryDate: expiry,
    uploadedAt: new Date().toISOString(),
    version,
  };
  app.documents.push(doc);
  audit(app, 'DOCUMENT_UPLOAD', { document_type: doc.documentType, version, issue_date: issue, expiry_date: expiry, demo_override: false });
  S.ui.uploadFor = null;
  S.ui.uploadErr = null;
  save(); render();
  toast(`Uploaded ${DOCUMENT_LABELS[doc.documentType]} v${version}. Run a check to re-evaluate.`);
}

function submitIntake(form) {
  const pid = form.product.value;
  const submission = form.submission.value;
  const employment = form.employment.value;
  const id = `RF-${S.seq++}`;
  const app = {
    id,
    borrower: form.borrower.value.trim() || 'Synthetic Applicant',
    product_id: pid,
    loan_amount: Number(form.amount.value),
    submission_date: submission,
    expected_decision_date: addDays(submission, seed.meta.processing_sla_days),
    attributes: {
      employment_type: employment,
      self_employed: employment === 'self_employed',
      tenure_months: Number(form.tenure.value || 0),
      loan_amount: Number(form.amount.value),
      ...(pid === 'home_loan' ? { security_type: form.security.value } : {}),
    },
    documents: [],
    runs: [],
    audit: [],
  };
  audit(app, 'APPLICATION_CREATE', {
    product_id: pid,
    submission_date: submission,
    processing_sla_days: seed.meta.processing_sla_days,
    expected_decision_date: app.expected_decision_date,
  });
  S.apps.push(app);
  save();
  location.hash = `#/applications/${id}`;
  toast(`Application ${id} created. Upload documents and run the first check.`);
}

function saveRules() {
  const draft = draftSet();
  const parsed = RuleSetSchema.safeParse(draft);
  if (!parsed.success) { toast('Draft rejected by the rule schema.', 'err'); return; }
  const pid = parsed.data.product_id;
  const old = S.active[pid];
  S.versions[pid].push(parsed.data);
  S.active[pid] = parsed.data.version;
  S.productAudit.push({
    at: new Date().toISOString(),
    actor: S.user.email,
    actor_role: S.user.role,
    event: 'RULE_VERSION_SAVED',
    detail: { product_id: pid, old_version: old, new_version: parsed.data.version, preview_ran_first: true, changed_rule_ids: Object.keys(S.ui.draft.ages) },
  });
  S.ui.draft = null;
  save(); render();
  toast(`Rule version ${parsed.data.version} is now active for ${product(pid).name} — in this session only.`, 'warn');
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  const app = el.dataset.app ? appById(el.dataset.app) : null;
  if (action === 'login') {
    S.user = seed.users.find((u) => u.role === el.dataset.role);
    globalAudit('AUTH_LOGIN', { demo_user: S.user.email });
    save();
    location.hash = '#/applications';
    render();
    return;
  }
  if (action === 'logout') { S.user = null; save(); location.hash = '#/login'; render(); return; }
  if (action === 'reset-demo') {
    sessionStorage.removeItem(KEY);
    S = fresh();
    location.hash = '#/login';
    render();
    toast('Seed data restored.');
    return;
  }
  if (action === 'run-check' && app && can('run_check')) { runCheck(app); return; }
  if (action === 'ack' && app && can('ack_warnings')) {
    const run = latestRun(app);
    S.acks[run.id] = true;
    audit(app, 'WARNINGS_ACKNOWLEDGED', { check_run_id: run.id, warning_count: evaluateRun(app, run).warningCount });
    save(); render();
    toast('Warnings acknowledged. Blocking items are unchanged (PRD §10.6).');
    return;
  }
  if (action === 'attach-open' && app) { S.ui.uploadFor = app.id + ':' + el.dataset.rule; S.ui.uploadErr = null; save(); render(); return; }
  if (action === 'attach-cancel') { S.ui.uploadFor = null; S.ui.uploadErr = null; save(); render(); return; }
  if (action === 'csv' && app && can('export_fix_pack_csv')) { exportCsv(app, evaluateRun(app, shownRun(app))); save(); return; }
  if (action === 'copy' && app && can('view_fix_pack')) { copyText(app, evaluateRun(app, shownRun(app))); save(); return; }
  if (action === 'view-run' && app) { S.viewRun[app.id] = el.dataset.run; save(); return; }
  if (action === 'rule-product') { S.ui.ruleProduct = el.dataset.product; S.ui.draft = null; save(); render(); return; }
  if (action === 'save-rules' && can('save_rules')) { saveRules(); return; }
});

document.addEventListener('submit', (e) => {
  if (e.target.id === 'upload-form') { e.preventDefault(); submitUpload(e.target); }
  if (e.target.id === 'intake-form') { e.preventDefault(); submitIntake(e.target); }
});

document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'role-switch') {
    S.user = seed.users.find((u) => u.role === t.value);
    globalAudit('AUTH_LOGIN', { demo_user: S.user.email });
    save(); render();
    toast(`Now signed in as ${S.user.role}. Actions your role cannot perform are hidden.`);
    return;
  }
  if (t.id === 'filter-status') { S.ui.status = t.value; save(); render(); return; }
  if (t.id === 'filter-product') { S.ui.product = t.value; save(); render(); return; }
  if (t.id === 'fix-warnings') { S.ui.fixWarnings = t.checked; save(); render(); return; }
  if (t.id === 'run-select') { S.viewRun[t.dataset.app] = t.value; save(); render(); return; }
  if (t.id === 'i-product') { S.ui.intakeProduct = t.value; save(); render(); return; }
  if (t.id === 'i-submission') { S.ui.intakeSubmission = t.value; save(); render(); return; }
  if (t.dataset.sandboxAge) { S.ui.draft.ages[t.dataset.sandboxAge] = Number(t.value); save(); render(); return; }
  if (t.dataset.sandboxHorizon !== undefined && t.id === 'd-horizon') { S.ui.draft.warning_horizon_days = Number(t.value); save(); render(); return; }
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'filter-q') {
    S.ui.q = e.target.value;
    save();
    const pos = e.target.selectionStart;
    render();
    const again = document.getElementById('filter-q');
    again.focus();
    again.setSelectionRange(pos, pos);
  }
});

window.addEventListener('hashchange', render);
render();