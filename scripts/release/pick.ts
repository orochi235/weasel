/**
 * `npm run release:pick`: choose the pending changesets that lead the next release.
 *
 *   npm run release:pick             list them, highest rank first, and ask
 *   npm run release:pick -- --list   list only
 *   npm run release:pick -- --set 3,7,12
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { parseChangesetFile } from '@changesets/parse';
import { isChangesetFile } from './bumps.mjs';
import { type EntryMeta, readMarker, setMarker } from './entry-marker.ts';
import { splitSummary } from './summary.ts';

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '.changeset');

interface Pending {
  file: string;
  text: string;
  summary: string;
  meta: EntryMeta;
  title: string;
}

/** The pending changesets that carry a valid marker, highest rank first, then by file name. */
export function readPending(dir = DIR): { pending: Pending[]; unmarked: string[] } {
  const pending: Pending[] = [];
  const unmarked: string[] = [];
  for (const file of readdirSync(dir).filter(isChangesetFile).sort()) {
    const text = readFileSync(join(dir, file), 'utf8');
    const { summary } = parseChangesetFile(text);
    const marker = readMarker(summary);
    if (!marker.ok) {
      unmarked.push(file);
      continue;
    }
    pending.push({ file, text, summary, meta: marker.meta, title: splitSummary(marker.body)[0] });
  }
  pending.sort((a, b) => b.meta.rank - a.meta.rank || a.file.localeCompare(b.file));
  return { pending, unmarked };
}

/** The file's text with its marker's `pick` set to `pick`. The frontmatter is left as written. */
export function withPick(text: string, summary: string, meta: EntryMeta, pick: boolean): string {
  const at = text.lastIndexOf(summary.trimEnd());
  if (at < 0) throw new Error('cannot find the changeset body in its file');
  return text.slice(0, at) + setMarker(summary, { ...meta, pick });
}

function parseNumbers(input: string, max: number): number[] {
  const numbers = input.split(/[\s,]+/).filter(Boolean).map(Number);
  const bad = numbers.filter((n) => !Number.isInteger(n) || n < 1 || n > max);
  if (bad.length) throw new Error(`not in 1–${max}: ${bad.join(', ')}`);
  return numbers;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const { pending, unmarked } = readPending();
  if (unmarked.length) {
    console.error(`${unmarked.length} changeset(s) have no valid marker and cannot be picked; run npm run check:changesets.`);
  }
  const width = String(pending.length).length;
  pending.forEach((p, i) => {
    const mark = p.meta.pick ? '*' : ' ';
    const rank = String(p.meta.rank).padStart(4);
    console.log(`${mark}${String(i + 1).padStart(width)} ${rank}  ${p.meta.tags.join(' ').padEnd(18)} ${p.title}`);
  });
  if (args.includes('--list')) return;

  const setAt = args.indexOf('--set');
  let input: string;
  if (setAt >= 0) input = args[setAt + 1] ?? '';
  else {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    input = await rl.question('\nPick (numbers, blank keeps the current picks): ');
    rl.close();
    if (!input.trim()) return;
  }
  const chosen = new Set(parseNumbers(input, pending.length).map((n) => n - 1));

  let changed = 0;
  pending.forEach((p, i) => {
    const pick = chosen.has(i);
    if (pick === p.meta.pick) return;
    writeFileSync(join(DIR, p.file), withPick(p.text, p.summary, p.meta, pick));
    changed++;
  });
  console.log(`${chosen.size} picked; ${changed} file(s) rewritten.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
