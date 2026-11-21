// Emits src/joiningTypes.gen.ts from the Unicode Character Database.
//
//   npm run gen:joining-types
//
// The joining types D, R, L, C and U are kept. Everything ArabicShaping.txt leaves out is U, or T where its
// General_Category is Mn, Me or Cf, which a caller tests with a regex rather than a table; a listed U row keeps a
// Cf such as U+0600 ARABIC NUMBER SIGN out of that fallback.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const UNICODE_VERSION = '16.0.0';
const url = `https://www.unicode.org/Public/${UNICODE_VERSION}/ucd/ArabicShaping.txt`;
const KEPT = new Set(['D', 'R', 'L', 'C', 'U']);

const res = await fetch(url);
if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
const text = await res.text();

const rows = [];
for (const raw of text.split('\n')) {
  const line = raw.split('#')[0].trim();
  if (line === '') continue;
  const [cp, , type] = line.split(';').map((f) => f.trim());
  if (KEPT.has(type)) rows.push([parseInt(cp, 16), type]);
}
rows.sort((a, b) => a[0] - b[0]);

// Runs of consecutive code points of one type, each `start(base 36)` `length(base 36)` `type`, comma separated.
const runs = [];
for (const [cp, type] of rows) {
  const last = runs.at(-1);
  if (last && last.type === type && last.start + last.length === cp) last.length++;
  else runs.push({ start: cp, length: 1, type });
}
const packed = runs.map((r) => `${r.start.toString(36)}.${r.length.toString(36)}${r.type}`).join(',');

const out = `/**
 * GENERATED FILE -- DO NOT EDIT BY HAND.
 *
 * Emitted by \`packages/text/scripts/gen-joining-types.mjs\` from ArabicShaping.txt, Unicode ${UNICODE_VERSION}.
 * Regenerate with \`npm run gen:joining-types\`.
 */

/** Runs of code points joining as D, R, L, C or U, each \`start.length\` in base 36 and its type. */
export const JOINING_RUNS = '${packed}';
`;

const target = fileURLToPath(new URL('../src/joiningTypes.gen.ts', import.meta.url));
writeFileSync(target, out);
console.log(`${rows.length} code points, ${runs.length} runs -> ${target}`);
