// Emits src/layout/lineBreak/lineBreakTable.ts from the Unicode Character
// Database: every code point's line-breaking class for UAX #14, plus the two
// other properties its rules read.
//
//   node packages/text/scripts/gen-line-break-table.mjs
//
// The extracted/Derived* files are used rather than LineBreak.txt and
// EastAsianWidth.txt because only they state their block defaults as
// `@missing` lines: the unassigned code points of the CJK blocks default to
// `ID` and `W`, not `XX` and `N`, and nothing but those lines says so in a
// form a script can read.
//
// LB1's resolution is applied here, so the table never holds AI, SG, XX, SA
// or CJ. QU is split by General_Category into initial (Pi), final (Pf) and
// other, because rules LB15a, LB15b and LB19 tell those apart.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const UNICODE_VERSION = '16.0.0';
const UCD = `https://www.unicode.org/Public/${UNICODE_VERSION}/ucd`;
const MAX_CP = 0x10ffff;

// Index order is the wire format. A value in the table is the class index,
// plus EAST_ASIAN when East_Asian_Width is F, W or H, plus PICTOGRAPHIC_CN
// for an unassigned Extended_Pictographic code point (rule LB30b).
const CLASSES = [
  'BK', 'CR', 'LF', 'NL', 'SP', 'ZW', 'ZWJ', 'CM', 'WJ', 'GL',
  'BA', 'BB', 'B2', 'HY', 'CB', 'CL', 'CP', 'EX', 'IN', 'NS',
  'OP', 'QU', 'IS', 'NU', 'PO', 'PR', 'SY', 'AL', 'HL', 'ID',
  'EB', 'EM', 'H2', 'H3', 'JL', 'JV', 'JT', 'RI', 'AK', 'AP',
  'AS', 'VF', 'VI', 'QU_PI', 'QU_PF',
];
const EAST_ASIAN = 64;
const PICTOGRAPHIC_CN = 128;

// UAX #44 long names, as the `@missing` lines spell them.
const LONG_NAMES = {
  Mandatory_Break: 'BK', Carriage_Return: 'CR', Line_Feed: 'LF', Next_Line: 'NL',
  Space: 'SP', ZWSpace: 'ZW', ZWJ: 'ZWJ', Combining_Mark: 'CM', Word_Joiner: 'WJ',
  Glue: 'GL', Break_After: 'BA', Break_Before: 'BB', Break_Both: 'B2', Hyphen: 'HY',
  Contingent_Break: 'CB', Close_Punctuation: 'CL', Close_Parenthesis: 'CP',
  Exclamation: 'EX', Inseparable: 'IN', Nonstarter: 'NS', Open_Punctuation: 'OP',
  Quotation: 'QU', Infix_Numeric: 'IS', Numeric: 'NU', Postfix_Numeric: 'PO',
  Prefix_Numeric: 'PR', Break_Symbols: 'SY', Alphabetic: 'AL', Hebrew_Letter: 'HL',
  Ideographic: 'ID', E_Base: 'EB', E_Modifier: 'EM', H2: 'H2', H3: 'H3', JL: 'JL',
  JV: 'JV', JT: 'JT', Regional_Indicator: 'RI', Aksara: 'AK', Aksara_Prebase: 'AP',
  Aksara_Start: 'AS', Virama_Final: 'VF', Virama: 'VI', Ambiguous: 'AI',
  Surrogate: 'SG', Unknown: 'XX', Complex_Context: 'SA', Conditional_Japanese_Starter: 'CJ',
};
const EAW_LONG = { Neutral: 'N', Wide: 'W', Fullwidth: 'F', Halfwidth: 'H', Narrow: 'Na', Ambiguous: 'A' };

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

/**
 * One value per code point, `@missing` defaults first — they are ordered
 * general-to-specific, so file order lets a block default override the
 * whole-range one — then the listed ranges over them.
 */
function buildProperty(text, parse, fallback) {
  const out = new Array(MAX_CP + 1).fill(fallback);
  for (const raw of text.split('\n')) {
    const m = /^#\s*@missing:\s*([0-9A-Fa-f.]+)\s*;\s*(\S+)\s*$/.exec(raw.trim());
    if (!m) continue;
    const [first, last] = parseRange(m[1]);
    out.fill(parse(m[2]), first, last + 1);
  }
  for (const fields of dataLines(text)) {
    const [first, last] = parseRange(fields[0]);
    out.fill(parse(fields[1]), first, last + 1);
  }
  return out;
}

const lbName = (v) => {
  const short = LONG_NAMES[v] ?? v;
  if (!Object.values(LONG_NAMES).includes(short)) throw new Error(`unknown Line_Break value: ${v}`);
  return short;
};

function buildTable({ lineBreak, generalCategory, eastAsianWidth, emoji }) {
  const lb = buildProperty(lineBreak, lbName, 'XX');
  const gc = buildProperty(generalCategory, (v) => v, 'Cn');
  const eaw = buildProperty(eastAsianWidth, (v) => EAW_LONG[v] ?? v, 'N');
  const pict = new Uint8Array(MAX_CP + 1);
  for (const fields of dataLines(emoji)) {
    if (fields[1] !== 'Extended_Pictographic') continue;
    const [first, last] = parseRange(fields[0]);
    pict.fill(1, first, last + 1);
  }

  const values = new Uint8Array(MAX_CP + 1);
  for (let cp = 0; cp <= MAX_CP; cp++) {
    let cls = lb[cp];
    // LB1, in the absence of a tailoring.
    if (cls === 'AI' || cls === 'SG' || cls === 'XX') cls = 'AL';
    else if (cls === 'SA') cls = gc[cp] === 'Mn' || gc[cp] === 'Mc' ? 'CM' : 'AL';
    else if (cls === 'CJ') cls = 'NS';
    else if (cls === 'QU' && gc[cp] === 'Pi') cls = 'QU_PI';
    else if (cls === 'QU' && gc[cp] === 'Pf') cls = 'QU_PF';
    const index = CLASSES.indexOf(cls);
    if (index < 0) throw new Error(`unhandled class ${cls} at ${cp.toString(16)}`);
    const e = eaw[cp];
    values[cp] = index
      | (e === 'F' || e === 'W' || e === 'H' ? EAST_ASIAN : 0)
      | (pict[cp] && gc[cp] === 'Cn' ? PICTOGRAPHIC_CN : 0);
  }
  return values;
}

// Palette indices are written as one character from this alphabet, which
// has no digits, so decimal run lengths keep the stream self-delimiting. It
// leaves out the quote and the backslash.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+,-./:;<=>?@[]^_{|}~';

function pack(values) {
  const palette = [...new Set(values)].sort((a, b) => a - b);
  if (palette.length > ALPHABET.length) throw new Error(`${palette.length} distinct values; the alphabet holds ${ALPHABET.length}`);
  const slot = new Map(palette.map((v, i) => [v, ALPHABET[i]]));
  let out = '';
  let runs = 0;
  let start = 0;
  for (let cp = 1; cp <= MAX_CP + 1; cp++) {
    if (cp <= MAX_CP && values[cp] === values[start]) continue;
    out += String(cp - start) + slot.get(values[start]);
    runs++;
    start = cp;
  }
  console.log(`  ${palette.length} distinct values, ${runs.toLocaleString()} runs, ${out.length.toLocaleString()} chars`);
  return { palette, packed: out, runs };
}

/** Break a long literal so the emitted file stays diffable and lint-clean. */
const chunk = (s, width = 96) => {
  const parts = [];
  for (let i = 0; i < s.length; i += width) parts.push(s.slice(i, i + width));
  return parts.map((p) => `  '${p}'`).join(' +\n');
};

const emit = ({ palette, packed, runs }) => `/**
 * GENERATED FILE -- DO NOT EDIT BY HAND.
 *
 * Emitted by \`packages/text/scripts/gen-line-break-table.mjs\` from the
 * Unicode Character Database. Regenerate with \`npm run gen:line-break-table\`.
 */

/** The Unicode release this table was generated from. */
export const UNICODE_VERSION = '${UNICODE_VERSION}';

// Line-breaking classes after UAX #14's LB1 resolution. QU_PI and QU_PF are
// QU split by General_Category Pi and Pf.
${CLASSES.map((c, i) => `export const ${c} = ${i};`).join('\n')}

/** Low bits of a {@link lineBreakPropsOf} value: the class. */
export const CLASS_MASK = 63;
/** East_Asian_Width is F, W or H — UAX #14's \`$EastAsian\`. */
export const EAST_ASIAN = ${EAST_ASIAN};
/** Unassigned and Extended_Pictographic, for rule LB30b. */
export const PICTOGRAPHIC_CN = ${PICTOGRAPHIC_CN};

const ALPHABET = '${ALPHABET}';
const PALETTE = [${palette.join(', ')}];

// Run-length encoding over the whole code space: each record is a decimal run
// length, then one ALPHABET character indexing PALETTE.
const RUNS = ${runs};
const PACKED =
${chunk(packed)};

let bmp: Uint8Array | null = null;
let astralStarts: Int32Array | null = null;
let astralValues: Uint8Array | null = null;

function decode(): void {
  const direct = new Uint8Array(0x10000);
  const starts = new Int32Array(RUNS);
  const values = new Uint8Array(RUNS);
  const slot = new Uint8Array(128);
  for (let i = 0; i < ALPHABET.length; i++) slot[ALPHABET.charCodeAt(i)] = PALETTE[i];
  let cp = 0;
  let run = 0;
  let len = 0;
  for (let i = 0; i < PACKED.length; i++) {
    const code = PACKED.charCodeAt(i);
    if (code <= 57 && code >= 48) len = len * 10 + code - 48;
    else {
      const v = slot[code];
      starts[run] = cp;
      values[run] = v;
      if (cp < 0x10000) direct.fill(v, cp, Math.min(cp + len, 0x10000));
      run++;
      cp += len;
      len = 0;
    }
  }
  bmp = direct;
  astralStarts = starts;
  astralValues = values;
}

/**
 * The class of \`cp\` in the low bits (\`& CLASS_MASK\`), with the
 * {@link EAST_ASIAN} and {@link PICTOGRAPHIC_CN} flags above them.
 */
export function lineBreakPropsOf(cp: number): number {
  if (bmp === null) decode();
  if (cp < 0x10000) return bmp![cp];
  if (cp > 0x10ffff) return AL;
  const starts = astralStarts!;
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= cp) lo = mid;
    else hi = mid - 1;
  }
  return astralValues![lo];
}
`;

const lineBreak = await fetchUcd('extracted/DerivedLineBreak.txt');
const generalCategory = await fetchUcd('extracted/DerivedGeneralCategory.txt');
const eastAsianWidth = await fetchUcd('extracted/DerivedEastAsianWidth.txt');
const emoji = await fetchUcd('emoji/emoji-data.txt');

const packed = pack(buildTable({ lineBreak, generalCategory, eastAsianWidth, emoji }));
const out = fileURLToPath(new URL('../src/layout/lineBreak/lineBreakTable.ts', import.meta.url));
const source = emit(packed);
writeFileSync(out, source);
console.log(`wrote ${out} (${source.length.toLocaleString()} bytes, Unicode ${UNICODE_VERSION})`);
