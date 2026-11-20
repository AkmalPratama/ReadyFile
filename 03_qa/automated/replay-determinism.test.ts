import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { ENGINE_VERSION, type RuleSet } from '../../02_source/packages/core/src/index.ts';
import { evaluate } from '../../02_source/packages/rules-engine/src/index.ts';
import type { CheckResult, DocumentMeta } from '../../02_source/packages/rules-engine/src/index.ts';
import {
  ALL_PRODUCT_RULE_SETS,
  demoApplication,
  demoDocumentsAtStep2,
  demoDocumentsAtStep8,
  salariedRuleSet,
} from './fixtures.ts';

/**
 * Replay determinism — exception E-21, pass criterion PC-28, NFR-02, TRD TC-02.
 *
 * E-21: *"Replaying a stored check run must reproduce the same result."* The
 * store itself is not built, so this suite exercises the property the store
 * depends on — `evaluate` is a pure function of its three arguments and of
 * nothing else. If that holds, persistence is bookkeeping; if it does not, no
 * amount of persistence makes replay sound.
 */

interface ReplayRecord {
  /** The engine version the run claims to have used. */
  engine_version: string;
  application: ReturnType<typeof demoApplication>;
  documents: DocumentMeta[];
  rules: RuleSet;
  warnings_acknowledged: boolean;
}

function replay(record: ReplayRecord): CheckResult {
  return evaluate({
    application: record.application,
    documents: record.documents,
    rules: record.rules,
    warningsAcknowledged: record.warnings_acknowledged,
  });
}

const REPLAY_RECORDS: readonly ReplayRecord[] = [
  {
    engine_version: ENGINE_VERSION,
    application: demoApplication(),
    documents: demoDocumentsAtStep2(),
    rules: salariedRuleSet(),
    warnings_acknowledged: false,
  },
  {
    engine_version: ENGINE_VERSION,
    application: demoApplication(),
    documents: demoDocumentsAtStep8(),
    rules: salariedRuleSet(),
    warnings_acknowledged: true,
  },
];

describe('E-21 / PC-28 — a round-tripped run reproduces byte-identically', () => {
  it('survives JSON serialization of the inputs, as a stored run would', () => {
    for (const record of REPLAY_RECORDS) {
      const original = replay(record);

      // The path a real replay takes: parse back what was written to the store.
      const revived = JSON.parse(JSON.stringify(record)) as ReplayRecord;
      const replayed = replay(revived);

      assert.deepEqual(replayed, original);
      assert.equal(JSON.stringify(replayed), JSON.stringify(original));
    }
  });

  it('is stable across repeated evaluation of the same record', () => {
    for (const record of REPLAY_RECORDS) {
      const runs = Array.from({ length: 5 }, () => replay(record));
      const [first, ...rest] = runs;
      for (const run of rest) {
        assert.equal(JSON.stringify(run), JSON.stringify(first));
      }
    }
  });

  it('holds for every product rule set, not just the demo product', () => {
    for (const rules of ALL_PRODUCT_RULE_SETS) {
      const record: ReplayRecord = {
        engine_version: ENGINE_VERSION,
        application: demoApplication(),
        documents: demoDocumentsAtStep2(),
        rules,
        warnings_acknowledged: false,
      };
      assert.deepEqual(
        replay(JSON.parse(JSON.stringify(record)) as ReplayRecord),
        replay(record),
      );
    }
  });
});

describe('NFR-02 — the result ignores ambient clock and randomness', () => {
  it('never consults Date.now or Math.random, and is unchanged if they lie', () => {
    const record = REPLAY_RECORDS[0]!;
    const baseline = JSON.stringify(replay(record));

    const realNow = Date.now;
    const realRandom = Math.random;
    let nowCalls = 0;
    let randomCalls = 0;
    try {
      Date.now = () => {
        nowCalls += 1;
        return realNow() + nowCalls * 86_400_000;
      };
      Math.random = () => {
        randomCalls += 1;
        return (randomCalls % 97) / 97;
      };
      // Guards against the test passing vacuously because the patch never landed.
      assert.notEqual(Date.now, realNow);
      assert.notEqual(Math.random, realRandom);

      for (let index = 0; index < 10; index += 1) {
        const nowBefore = nowCalls;
        const randomBefore = randomCalls;
        const result = JSON.stringify(replay(record));
        // Counted around the engine call only, so the test runner's own timing
        // cannot be mistaken for the engine reading the clock.
        assert.equal(nowCalls - nowBefore, 0, 'evaluate() read the wall clock');
        assert.equal(randomCalls - randomBefore, 0, 'evaluate() used randomness');
        assert.equal(result, baseline);
      }
    } finally {
      Date.now = realNow;
      Math.random = realRandom;
    }

    assert.equal(Date.now, realNow);
    assert.equal(Math.random, realRandom);
    assert.equal(JSON.stringify(replay(record)), baseline);
  });

  it('is unchanged when the run straddles a UTC midnight boundary', () => {
    // Ages are computed against dates in the record, so the wall clock crossing
    // midnight cannot age a document. This is the drift risk TRD §17 names.
    const record = REPLAY_RECORDS[0]!;
    const expected = JSON.stringify(replay(record));

    const realNow = Date.now;
    try {
      Date.now = () => realNow() + 36 * 3_600_000;
      assert.equal(JSON.stringify(replay(record)), expected);
    } finally {
      Date.now = realNow;
    }
  });
});

describe('NFR-02 — the result ignores input ordering', () => {
  it('is unchanged when the document list is rotated', () => {
    const documents = demoDocumentsAtStep8();
    const rules = salariedRuleSet();
    const expected = JSON.stringify(
      evaluate({ application: demoApplication(), documents, rules }),
    );

    for (let offset = 1; offset < documents.length; offset += 1) {
      const rotated = [...documents.slice(offset), ...documents.slice(0, offset)];
      assert.equal(
        JSON.stringify(evaluate({ application: demoApplication(), documents: rotated, rules })),
        expected,
        `rotation by ${offset} changed the result`,
      );
    }
  });

  it('is unchanged when the rule set items are reversed', () => {
    const base = salariedRuleSet();
    const reversed: RuleSet = { ...base, items: [...base.items].reverse() };

    const expected = JSON.stringify(
      evaluate({ application: demoApplication(), documents: demoDocumentsAtStep2(), rules: base }),
    );
    const actual = JSON.stringify(
      evaluate({ application: demoApplication(), documents: demoDocumentsAtStep2(), rules: reversed }),
    );

    assert.equal(actual, expected);
    assert.deepEqual(
      evaluate({ application: demoApplication(), documents: demoDocumentsAtStep2(), rules: reversed })
        .items.map((entry) => entry.ruleId),
      ['PS-ADR-01', 'PS-BANK-01', 'PS-CBR-01', 'PS-EVL-01', 'PS-ID-01', 'PS-PSL-01'],
      'items must be published in code-unit rule_id order regardless of input order',
    );
  });

  it('does not mutate the rule set or document list it was given', () => {
    const rules = salariedRuleSet();
    const documents = demoDocumentsAtStep8();
    const rulesBefore = JSON.stringify(rules);
    const documentsBefore = JSON.stringify(documents);

    evaluate({ application: demoApplication(), documents, rules });

    assert.equal(JSON.stringify(rules), rulesBefore);
    assert.equal(JSON.stringify(documents), documentsBefore);
  });
});

describe('Known limitation — the result carries no engine version', () => {
  it('omits engine_version from CheckResult, so a stored run cannot self-identify', () => {
    const result = replay(REPLAY_RECORDS[0]!);
    assert.deepEqual(Object.keys(result).sort(), [
      'applicableRequiredCount',
      'blockingCount',
      'countsByStatus',
      'items',
      'overallStatus',
      'score',
      'validRequiredCount',
      'warningCount',
    ]);
    assert.equal('engineVersion' in result, false);
    assert.equal('engine_version' in result, false);
  });

  it('exposes ENGINE_VERSION separately, leaving the pairing to a caller that is not built', () => {
    assert.equal(typeof ENGINE_VERSION, 'string');
    assert.match(ENGINE_VERSION, /^\d+\.\d+\.\d+$/);
  });
});

/**
 * PC-29 — *"Engine contains no `Date.now()`, no randomness, no I/O. 0 occurrences
 * (static check)."* The behavioural suite above proves the engine does not
 * consult those sources at runtime; this proves it cannot, by construction.
 */
const ENGINE_SRC = fileURLToPath(new URL('../../02_source/packages/rules-engine/', import.meta.url));
const CORE_SRC = fileURLToPath(new URL('../../02_source/packages/core/', import.meta.url));

/** Comments legitimately contain the forbidden words ("no `Date.now()`"), so
 *  strip them before counting. Naive, but adequate for hand-written sources. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function sourceFiles(directory: string): string[] {
  return readdirSync(`${directory}src`)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => `${directory}src/${name}`);
}

const FORBIDDEN: readonly { token: RegExp; why: string }[] = [
  { token: /Date\.now\s*\(/, why: 'wall-clock read' },
  { token: /new\s+Date\s*\(\s*\)/, why: 'implicit current-time construction' },
  { token: /Math\.random\s*\(/, why: 'randomness' },
  { token: /performance\.now\s*\(/, why: 'ambient timing' },
  { token: /from\s+['"]node:/, why: 'Node built-in import (potential I/O)' },
  { token: /require\s*\(/, why: 'dynamic require' },
  { token: /\bfetch\s*\(/, why: 'network' },
  { token: /\bprocess\./, why: 'environment or runtime state' },
  { token: /\bimport\.meta\b/, why: 'module-location-dependent behaviour' },
];

describe('PC-29 — static check: the engine has no clock, no randomness, no I/O', () => {
  it('finds zero forbidden constructs in @readyfile/rules-engine source', () => {
    const files = sourceFiles(ENGINE_SRC);
    assert.ok(files.length >= 7, `expected the engine sources, found ${files.length}`);

    const hits: string[] = [];
    for (const file of files) {
      const code = codeOnly(readFileSync(file, 'utf8'));
      for (const { token, why } of FORBIDDEN) {
        if (token.test(code)) hits.push(`${file.split('/').pop()}: ${why}`);
      }
    }
    assert.deepEqual(hits, []);
  });

  it('finds no wall-clock or randomness in @readyfile/core date arithmetic', () => {
    // core/dates.ts legitimately uses `Date.UTC(...)` and `new Date(ms)` — both are
    // pure functions of their arguments. What it must not use is the current time.
    const hits: string[] = [];
    for (const file of sourceFiles(CORE_SRC)) {
      const code = codeOnly(readFileSync(file, 'utf8'));
      for (const { token, why } of FORBIDDEN) {
        if (token.test(code)) hits.push(`${file.split('/').pop()}: ${why}`);
      }
    }
    assert.deepEqual(hits, []);
  });

  it('declares no runtime dependency that could reintroduce I/O', () => {
    const manifest = JSON.parse(
      readFileSync(`${ENGINE_SRC}package.json`, 'utf8'),
    ) as { dependencies?: Record<string, string> };
    assert.deepEqual(Object.keys(manifest.dependencies ?? {}), ['@readyfile/core']);
  });
});
