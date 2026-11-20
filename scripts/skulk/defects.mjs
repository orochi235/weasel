/**
 * The defects each round found in one area, for the audit page: from the round's record where it has landed, or else
 * from its night directory, each with what was broken, what became of it and what the fix changed.
 *
 *   node scripts/skulk/defects.mjs <area>     the area's rounds as JSON, newest first
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STATE_DIR } from './config.mjs';
import { reportItems } from './findings.mjs';
import { AUDITS_DIR } from './rounds.mjs';

const readIf = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : null);

/** The findings a match paired, as items no fixer has answered yet: shared ones once, then each reviewer's own. */
export const openItems = (match) => {
  const a = match.a ?? [], b = match.b ?? [], pairs = match.pairs ?? [];
  const pairedA = new Set(pairs.map(([i]) => i)), pairedB = new Set(pairs.map(([, j]) => j));
  const open = (claim, from) => ({ claim, from, verdict: 'open', note: '' });
  return [
    ...pairs.map(([i]) => open(a[i], 'A+B')),
    ...a.flatMap((c, i) => (pairedA.has(i) ? [] : [open(c, 'A')])),
    ...b.flatMap((c, j) => (pairedB.has(j) ? [] : [open(c, 'B')])),
  ];
};

/** The subject of each commit in a fixer's mbox, a folded subject joined back into one line. */
export const commitSubjects = (mbox) =>
  [...mbox.matchAll(/^Subject: (?:\[PATCH[^\]]*\] )?(.*(?:\n[ \t].*)*)/gm)].map((m) => m[1].replace(/\n[ \t]+/g, ' ').trim());

/**
 * One round's items for an area, from the directory holding its files: the fixer's report, or else the match, with
 * the commits of a fixer that left some but no report, as one stopped partway does.
 */
const itemsIn = (dir) => {
  const report = readIf(join(dir, 'fix.md'));
  if (report !== null) return { fixed: true, items: reportItems(report) };
  const match = readIf(join(dir, 'match.json'));
  if (match === null) return null;
  const mbox = readIf(join(dir, 'fix.mbox'));
  return { fixed: false, items: openItems(JSON.parse(match)), ...(mbox ? { commits: commitSubjects(mbox) } : {}) };
};

const ROUND = /^round-(\d+)$/;
const NIGHT = /-round(\d+)$/;

/** Every round that has read `id`, newest first: `{ round, recorded, fixed, items, commits? }`. */
export const areaDefects = (root, id, state = STATE_DIR) => {
  const found = new Map();
  const audits = join(root, AUDITS_DIR);
  for (const name of existsSync(audits) ? readdirSync(audits) : []) {
    const m = ROUND.exec(name);
    const got = m && itemsIn(join(audits, name, id));
    if (got) found.set(Number(m[1]), { round: Number(m[1]), recorded: true, ...got });
  }
  const nights = join(state, 'nights');
  for (const name of existsSync(nights) ? readdirSync(nights).sort() : []) {
    const m = NIGHT.exec(name);
    if (!m || found.get(Number(m[1]))?.recorded) continue;
    const got = itemsIn(join(nights, name, 'areas', id));
    if (got) found.set(Number(m[1]), { round: Number(m[1]), recorded: false, ...got });
  }
  return [...found.values()].sort((x, y) => y.round - x.round);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.env.WEASEL_ROOT ?? process.cwd();
  process.stdout.write(`${JSON.stringify(areaDefects(root, process.argv[2] ?? ''))}\n`);
}
