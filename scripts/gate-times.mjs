#!/usr/bin/env node
// Reads the gate's numbers out of `npm run test:fleet` logs: the run's commit and node, the gate's
// wall time, each check's time or skip, and the suite's. Appends one JSON line per log to --out.
//
//   node scripts/gate-times.mjs --config one-file-before --out scripts/gate-times.runs.jsonl fleet.log
import { appendFileSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
  options: { config: { type: 'string', default: '' }, node: { type: 'string' }, out: { type: 'string' } },
  allowPositionals: true,
});

const plain = (text) => text.replace(/\x1b\[[0-9;]*m/g, '');

const record = (log) => {
  const text = plain(readFileSync(log, 'utf8'));
  const gate = /ci-checks\.gate\.ts \((\d+) tests?(?: \| (\d+) skipped)?\) (\d+)ms/.exec(text);
  const checks = {};
  for (const [, mark, rest] of text.matchAll(/^\s+(✓|×|↓) npm run (.+)$/gm)) {
    const ms = / (\d+)ms$/.exec(rest)?.[1];
    const name = rest.split(' ')[0];
    if (!(name in checks)) checks[name] = mark === '↓' ? 'skipped' : { ok: mark === '✓', ms: ms ? Number(ms) : null };
  }
  for (const [, name] of text.matchAll(/^gate: skipped npm run (\S+):/gm)) checks[name] = 'skipped';
  return {
    config: values.config,
    log,
    commit: /changed path\(s\) match ([0-9a-f]{40})/.exec(text)?.[1] ?? null,
    node: values.node ?? /^\s*(\S+)\s+chosen:/m.exec(text)?.[1] ?? null,
    selectedPaths: Number(/selecting from the (\d+) path/.exec(text)?.[1] ?? NaN) || null,
    gateMs: gate ? Number(gate[3]) : null,
    gateSkipped: gate?.[2] ? Number(gate[2]) : 0,
    suiteSeconds: [...text.matchAll(/Duration\s+([\d.]+)s/g)].map((m) => Number(m[1])),
    void: /this run is void/.test(text),
    checks,
  };
};

for (const log of positionals) {
  const row = record(log);
  if (values.out) appendFileSync(values.out, `${JSON.stringify(row)}\n`);
  console.log(`${String(row.gateMs ?? '-').padStart(7)}ms gate  ${row.node ?? '-'}  ${values.config}  ${log}`);
}
