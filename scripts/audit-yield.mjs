#!/usr/bin/env node
// Fix commits per audit round and lane, read from the merges of `audit<N>-<lane>` branches.
// A commit is a proxy for a fix: rounds whose HANDOFF entry gave a fix count ran about 1.1–1.4
// commits per fix (changesets and test repairs ride along).
//
//   node scripts/audit-yield.mjs            per-round totals and the lane × round table
//   node scripts/audit-yield.mjs --json     one record per merged lane branch
import { execFileSync } from 'node:child_process';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

const merges = git('log', '--merges', '--format=%H%x09%ad%x09%s', '--date=short', '--grep=audit')
  .split('\n')
  .filter(Boolean);

const lanes = new Map();
for (const line of merges) {
  const [sha, date, subject] = line.split('\t');
  const m = subject.match(/branch '(audit(\d*)-([^']+))'/);
  if (!m) continue;
  const [, branch, n, lane] = m;
  const round = n ? Number(n) : 1;
  const commits = Number(git('rev-list', '--no-merges', '--count', `${sha}^1..${sha}^2`));
  const rec = lanes.get(branch) ?? { round, lane, branch, commits: 0, first: date, last: date };
  rec.commits += commits;
  if (date < rec.first) rec.first = date;
  if (date > rec.last) rec.last = date;
  lanes.set(branch, rec);
}

const records = [...lanes.values()].sort((a, b) => a.round - b.round || a.lane.localeCompare(b.lane));

if (process.argv.includes('--json')) {
  for (const r of records) console.log(JSON.stringify(r));
  process.exit(0);
}

const rounds = new Map();
for (const r of records) {
  const t = rounds.get(r.round) ?? { lanes: 0, commits: 0, date: r.first };
  t.lanes += 1;
  t.commits += r.commits;
  if (r.first < t.date) t.date = r.first;
  rounds.set(r.round, t);
}
console.log('round  date        lanes  commits  per lane');
for (const [round, t] of [...rounds].sort((a, b) => a[0] - b[0])) {
  const per = (t.commits / t.lanes).toFixed(1);
  console.log(
    `${String(round).padStart(5)}  ${t.date}  ${String(t.lanes).padStart(5)}  ${String(t.commits).padStart(7)}  ${per.padStart(8)}`,
  );
}

const roundIds = [...rounds.keys()].sort((a, b) => a - b);
const byLane = new Map();
for (const r of records) {
  if (!byLane.has(r.lane)) byLane.set(r.lane, new Map());
  byLane.get(r.lane).set(r.round, r.commits);
}
const repeated = [...byLane].filter(([, m]) => m.size > 1).sort((a, b) => a[0].localeCompare(b[0]));
if (repeated.length) {
  const width = Math.max(4, ...repeated.map(([l]) => l.length));
  console.log(`\nlanes audited more than once\n${'lane'.padEnd(width)} ${roundIds.map((n) => `r${n}`.padStart(4)).join(' ')}`);
  for (const [lane, m] of repeated) {
    console.log(`${lane.padEnd(width)} ${roundIds.map((n) => String(m.get(n) ?? '·').padStart(4)).join(' ')}`);
  }
}
