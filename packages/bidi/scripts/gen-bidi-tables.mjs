// Emits src/tables.ts from the Unicode Character Database.
//
//   node packages/bidi/scripts/gen-bidi-tables.mjs
//
// DerivedBidiClass.txt only lists *assigned* code points; the default for
// everything else is declared by its `@missing` lines, and those are not all
// `L` — the unassigned holes in the Hebrew, Arabic, Thaana, Syriac, Samaritan
// and the RTL supplementary blocks default to `R` or `AL`. Dropping them makes
// unassigned RTL code points read as left-to-right, which no test of assigned
// characters can catch.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const UNICODE_VERSION = '16.0.0';
const UCD = `https://www.unicode.org/Public/${UNICODE_VERSION}/ucd`;

const MAX_CP = 0x10ffff;

// Index order is the wire format: a class is stored as the letter at its index.
const CLASSES = [
  'L', 'R', 'AL',
  'EN', 'ES', 'ET', 'AN', 'CS', 'NSM', 'BN',
  'B', 'S', 'WS', 'ON',
  'LRE', 'RLE', 'LRO', 'RLO', 'PDF',
  'LRI', 'RLI', 'FSI', 'PDI',
];

// UAX #44 long names, as the `@missing` lines spell them.
const LONG_NAMES = {
  Left_To_Right: 'L',
  Right_To_Left: 'R',
  Arabic_Letter: 'AL',
  European_Number: 'EN',
  European_Separator: 'ES',
  European_Terminator: 'ET',
  Arabic_Number: 'AN',
  Common_Separator: 'CS',
  Nonspacing_Mark: 'NSM',
  Boundary_Neutral: 'BN',
  Paragraph_Separator: 'B',
  Segment_Separator: 'S',
  White_Space: 'WS',
  Other_Neutral: 'ON',
  Left_To_Right_Embedding: 'LRE',
  Right_To_Left_Embedding: 'RLE',
  Left_To_Right_Override: 'LRO',
  Right_To_Left_Override: 'RLO',
  Pop_Directional_Format: 'PDF',
  Left_To_Right_Isolate: 'LRI',
  Right_To_Left_Isolate: 'RLI',
  First_Strong_Isolate: 'FSI',
  Pop_Directional_Isolate: 'PDI',
};

const indexOfClass = (name) => {
  const short = CLASSES.includes(name) ? name : LONG_NAMES[name];
  const i = short === undefined ? -1 : CLASSES.indexOf(short);
  if (i < 0) throw new Error(`unknown Bidi_Class value: ${name}`);
  return i;
};

async function fetchUcd(name) {
  const url = `${UCD}/${name}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const text = await res.text();
  console.log(`fetched ${name} (${text.length.toLocaleString()} bytes)`);
  return text;
}

/** `0041..005A` or `0041` -> `[first, last]`. */
const parseRange = (field) => {
  const [a, b] = field.trim().split('..');
  const first = parseInt(a, 16);
  return [first, b === undefined ? first : parseInt(b, 16)];
};

/** Every non-comment `first..last ; value` line, with comments stripped. */
function* dataLines(text) {
  for (const raw of text.split('\n')) {
    const line = raw.split('#')[0].trim();
    if (line === '') continue;
    yield line.split(';').map((f) => f.trim());
  }
}

function buildBidiClass(text) {
  const cls = new Uint8Array(MAX_CP + 1);

  // `@missing` lines are ordered general-to-specific, so applying them in file
  // order lets a block default override the 0000..10FFFF one.
  for (const raw of text.split('\n')) {
    const m = /^#\s*@missing:\s*([0-9A-Fa-f.]+)\s*;\s*(\S+)\s*$/.exec(raw.trim());
    if (!m) continue;
    const [first, last] = parseRange(m[1]);
    cls.fill(indexOfClass(m[2]), first, last + 1);
  }

  let assigned = 0;
  for (const fields of dataLines(text)) {
    const [first, last] = parseRange(fields[0]);
    cls.fill(indexOfClass(fields[1]), first, last + 1);
    assigned += last - first + 1;
  }
  console.log(`  Bidi_Class: ${assigned.toLocaleString()} assigned code points`);
  return cls;
}

const B36 = (n) => n.toString(36).toUpperCase();

/**
 * Run-length encode the whole code space. Coverage is total, so a run's start
 * is the sum of every preceding length and only (length, class) is stored.
 * Lengths are uppercase base 36 and classes are one lowercase letter, which
 * makes the stream self-delimiting.
 */
function packBidiClass(cls) {
  let out = '';
  let runs = 0;
  let start = 0;
  for (let cp = 1; cp <= MAX_CP + 1; cp++) {
    if (cp <= MAX_CP && cls[cp] === cls[start]) continue;
    out += B36(cp - start) + String.fromCharCode(97 + cls[start]);
    runs++;
    start = cp;
  }
  console.log(`  Bidi_Class: ${runs.toLocaleString()} runs, ${out.length.toLocaleString()} chars`);
  return { packed: out, runs };
}

function buildBrackets(text) {
  const rows = [];
  for (const fields of dataLines(text)) {
    const cp = parseInt(fields[0], 16);
    const pair = parseInt(fields[1], 16);
    const kind = fields[2];
    if (kind !== 'o' && kind !== 'c') throw new Error(`bad bracket type: ${kind}`);
    rows.push([cp, pair, kind]);
  }
  rows.sort((a, b) => a[0] - b[0]);
  console.log(`  Bidi_Paired_Bracket: ${rows.length} entries`);
  return rows.map(([cp, pair, kind]) => `${B36(cp)}${kind}${B36(pair)}`).join(',');
}

function buildMirroring(text) {
  const rows = [];
  for (const fields of dataLines(text)) {
    rows.push([parseInt(fields[0], 16), parseInt(fields[1], 16)]);
  }
  rows.sort((a, b) => a[0] - b[0]);
  console.log(`  Bidi_Mirroring_Glyph: ${rows.length} entries`);
  return rows.map(([cp, m]) => `${B36(cp)}:${B36(m)}`).join(',');
}

/** Break a long literal so the emitted file stays diffable and lint-clean. */
const chunk = (s, width = 96) => {
  const parts = [];
  for (let i = 0; i < s.length; i += width) parts.push(s.slice(i, i + width));
  return parts.map((p) => `  '${p}'`).join(' +\n');
};

const emit = ({ packed, runs, brackets, mirroring }) => `/**
 * GENERATED FILE -- DO NOT EDIT BY HAND.
 *
 * Emitted by \`packages/bidi/scripts/gen-bidi-tables.mjs\` from the Unicode
 * Character Database. Regenerate with \`npm run gen:bidi-tables\`.
 */

import type { BidiClass, PairedBracket } from './types';

/** The Unicode release these tables were generated from. */
export const UNICODE_VERSION = '${UNICODE_VERSION}';

const CLASSES: readonly BidiClass[] = [
${CLASSES.map((c) => `  '${c}',`).join('\n')}
];

// Run-length encoding of Bidi_Class over the whole code space, defaults from
// DerivedBidiClass.txt's \`@missing\` lines included. Each record is a run
// length in uppercase base 36 followed by one lowercase letter indexing
// CLASSES; coverage is total, so each run starts where the last one ended.
const CLASS_RUNS = ${runs};
const CLASS_PACKED =
${chunk(packed)};

// \`<code point>[oc]<pair>\` per entry, base 36, ascending by code point.
const BRACKETS =
${chunk(brackets)};

// \`<code point>:<mirror>\` per entry, base 36, ascending by code point.
const MIRRORING =
${chunk(mirroring)};

let starts: Int32Array | null = null;
let values: Uint8Array | null = null;

function classTable(): { starts: Int32Array; values: Uint8Array } {
  if (starts === null || values === null) {
    const s = new Int32Array(CLASS_RUNS);
    const v = new Uint8Array(CLASS_RUNS);
    let cp = 0;
    let run = 0;
    let len = 0;
    for (let i = 0; i < CLASS_PACKED.length; i++) {
      const code = CLASS_PACKED.charCodeAt(i);
      if (code >= 97) {
        s[run] = cp;
        v[run] = code - 97;
        run++;
        cp += len;
        len = 0;
      } else {
        len = len * 36 + (code <= 57 ? code - 48 : code - 55);
      }
    }
    starts = s;
    values = v;
  }
  return { starts, values };
}

let brackets: Map<number, PairedBracket> | null = null;
let mirrors: Map<number, number> | null = null;

/**
 * The \`Bidi_Class\` of a code point.
 *
 * Unassigned code points resolve to the default their block declares, which is
 * \`R\` or \`AL\` inside the right-to-left blocks and \`L\` elsewhere.
 */
export function bidiClassOf(cp: number): BidiClass {
  if (!Number.isInteger(cp) || cp < 0 || cp > 0x10ffff) return 'L';
  const table = classTable();
  let lo = 0;
  let hi = table.starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (table.starts[mid] <= cp) lo = mid;
    else hi = mid - 1;
  }
  return CLASSES[table.values[lo]];
}

/**
 * The \`Bidi_Paired_Bracket\` of a code point, for BD16 and rule N0, or \`null\`
 * where the code point is not one half of a pair.
 */
export function pairedBracket(cp: number): PairedBracket | null {
  if (brackets === null) {
    brackets = new Map();
    for (const record of BRACKETS.split(',')) {
      const at = record.search(/[oc]/);
      brackets.set(parseInt(record.slice(0, at), 36), {
        pair: parseInt(record.slice(at + 1), 36),
        kind: record[at] === 'o' ? 'open' : 'close',
      });
    }
  }
  return brackets.get(cp) ?? null;
}

/**
 * The \`Bidi_Mirroring_Glyph\` of a code point, or \`null\` where it has none.
 *
 * This is the mapping rule L4 applies, and only that: it is a hint for
 * selecting a mirrored glyph, not a character transformation, and a font's own
 * \`rtlm\` feature supersedes it where one exists.
 */
export function mirrorOf(cp: number): number | null {
  if (mirrors === null) {
    mirrors = new Map();
    for (const record of MIRRORING.split(',')) {
      const at = record.indexOf(':');
      mirrors.set(parseInt(record.slice(0, at), 36), parseInt(record.slice(at + 1), 36));
    }
  }
  return mirrors.get(cp) ?? null;
}
`;

const derived = await fetchUcd('extracted/DerivedBidiClass.txt');
const bracketsTxt = await fetchUcd('BidiBrackets.txt');
const mirroringTxt = await fetchUcd('BidiMirroring.txt');

const { packed, runs } = packBidiClass(buildBidiClass(derived));
const brackets = buildBrackets(bracketsTxt);
const mirroring = buildMirroring(mirroringTxt);

const out = fileURLToPath(new URL('../src/tables.ts', import.meta.url));
const source = emit({ packed, runs, brackets, mirroring });
writeFileSync(out, source);
console.log(`wrote ${out} (${source.length.toLocaleString()} bytes, Unicode ${UNICODE_VERSION})`);
