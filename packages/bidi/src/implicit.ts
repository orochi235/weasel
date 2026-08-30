/**
 * W1–W7, N0–N2 and I1–I2 — resolving weak and neutral types to a direction.
 *
 * Every rule here runs over one isolating run sequence, in order, each seeing
 * what the previous left behind. The ordering is load-bearing in ways that are
 * invisible from any single rule: W2 reads the last strong type while `AL` is
 * still `AL`, and W3 then erases `AL` — swap them and Arabic-Indic digits stop
 * being recognised.
 */

import type { BidiClass } from './types';
import type { IsolatingRunSequence } from './sequences';
import { pairedBracket } from './tables';

/** BD16 — the pairing stack is capped, and overflow abandons N0 entirely. */
const MAX_PAIRING_DEPTH = 63;

/**
 * BD16 requires canonical equivalents to pair with each other, and there is
 * exactly one such case in the data: the angle brackets U+2329/U+232A are
 * canonically equivalent to U+3008/U+3009. `a⟨b.1〉` is a real pair and matching
 * raw code points misses it.
 */
function canonicalBracket(cp: number): number {
  if (cp === 0x3008) return 0x2329;
  if (cp === 0x3009) return 0x232a;
  return cp;
}

/** "NI" in the spec: neutral or isolate formatting. */
function isNI(c: BidiClass): boolean {
  return c === 'B' || c === 'S' || c === 'WS' || c === 'ON'
    || c === 'FSI' || c === 'LRI' || c === 'RLI' || c === 'PDI';
}

/** N1 treats both number classes as right-to-left. */
function n1Direction(c: BidiClass): 'L' | 'R' | null {
  if (c === 'L') return 'L';
  if (c === 'R' || c === 'EN' || c === 'AN') return 'R';
  return null;
}

export function resolveImplicit(
  seq: IsolatingRunSequence,
  classes: BidiClass[],
  levels: Uint8Array,
  codePoints: readonly number[] | null,
): void {
  const idx = seq.indices;
  const n = idx.length;
  if (n === 0) return;

  // Work on a dense copy so the rules read neighbours by sequence position
  // rather than by text position — the two differ wherever an isolate or an
  // X9 removal sits between them.
  const t: BidiClass[] = idx.map((i) => classes[i]);
  // N0's last clause is specified against the types *before* W1, and W1 is
  // about to overwrite exactly the NSMs it asks about.
  const beforeW1: BidiClass[] = t.slice();
  const e: 'L' | 'R' = seq.level % 2 === 1 ? 'R' : 'L';

  // W1 — a combining mark takes the type of what it attaches to. It attaches
  // to nothing across an isolate boundary, so those give ON rather than their
  // own class.
  for (let i = 0; i < n; i++) {
    if (t[i] !== 'NSM') continue;
    if (i === 0) { t[i] = seq.sos; continue; }
    const prev = t[i - 1];
    t[i] = (prev === 'LRI' || prev === 'RLI' || prev === 'FSI' || prev === 'PDI')
      ? 'ON'
      : prev;
  }

  // W2 — read against the last strong type, while AL is still AL.
  let strong: BidiClass = seq.sos;
  for (let i = 0; i < n; i++) {
    const c = t[i];
    if (c === 'L' || c === 'R' || c === 'AL') strong = c;
    else if (c === 'EN' && strong === 'AL') t[i] = 'AN';
  }

  // W3.
  for (let i = 0; i < n; i++) if (t[i] === 'AL') t[i] = 'R';

  // W4 — a single separator between two numbers of the same kind joins them.
  for (let i = 1; i < n - 1; i++) {
    const c = t[i];
    if (c === 'ES' && t[i - 1] === 'EN' && t[i + 1] === 'EN') t[i] = 'EN';
    else if (c === 'CS' && t[i - 1] === 'EN' && t[i + 1] === 'EN') t[i] = 'EN';
    else if (c === 'CS' && t[i - 1] === 'AN' && t[i + 1] === 'AN') t[i] = 'AN';
  }

  // W5 — a whole run of terminators joins an adjacent European number, from
  // either side, which is why it is a run scan rather than a neighbour test.
  for (let i = 0; i < n; i++) {
    if (t[i] !== 'ET') continue;
    let j = i;
    while (j < n && t[j] === 'ET') j++;
    const before = i > 0 && t[i - 1] === 'EN';
    const after = j < n && t[j] === 'EN';
    if (before || after) for (let k = i; k < j; k++) t[k] = 'EN';
    i = j - 1;
  }

  // W6.
  for (let i = 0; i < n; i++) {
    if (t[i] === 'ET' || t[i] === 'ES' || t[i] === 'CS') t[i] = 'ON';
  }

  // W7 — unlike W2 this rewrites to L, so it must follow W6's neutralisation.
  strong = seq.sos;
  for (let i = 0; i < n; i++) {
    const c = t[i];
    if (c === 'L' || c === 'R') strong = c;
    else if (c === 'EN' && strong === 'L') t[i] = 'L';
  }

  // N0 — bracket pairs, when the caller gave us code points to pair with.
  if (codePoints) resolveBracketPairs(t, beforeW1, idx, codePoints, e, seq.sos);

  // N1 — a run of neutrals between two of the same direction takes it.
  for (let i = 0; i < n; i++) {
    if (!isNI(t[i])) continue;
    let j = i;
    while (j < n && isNI(t[j])) j++;
    const before = i === 0 ? seq.sos : n1Direction(t[i - 1]);
    const after = j === n ? seq.eos : n1Direction(t[j]);
    // N2 is the fallback for everything N1 leaves: differing sides, or a side
    // that is not a direction at all.
    const fill = before !== null && before === after ? before : e;
    for (let k = i; k < j; k++) t[k] = fill;
    i = j - 1;
  }

  // I1 / I2.
  for (let i = 0; i < n; i++) {
    const level = levels[idx[i]];
    const c = t[i];
    if (level % 2 === 0) {
      if (c === 'R') levels[idx[i]] = level + 1;
      else if (c === 'AN' || c === 'EN') levels[idx[i]] = level + 2;
    } else if (c === 'L' || c === 'AN' || c === 'EN') {
      levels[idx[i]] = level + 1;
    }
  }

  for (let i = 0; i < n; i++) classes[idx[i]] = t[i];
}

/**
 * N0 with BD16 — a bracket pair takes one direction, decided by what it
 * encloses rather than by each bracket's own neighbours.
 *
 * The rule exists because N1/N2 treat the two brackets independently and will
 * happily send them opposite ways, which renders as mismatched parentheses.
 */
function resolveBracketPairs(
  t: BidiClass[],
  beforeW1: readonly BidiClass[],
  idx: readonly number[],
  codePoints: readonly number[],
  e: 'L' | 'R',
  sos: 'L' | 'R',
): void {
  const n = t.length;
  const stack: Array<{ closer: number; pos: number }> = [];
  const pairs: Array<[number, number]> = [];

  for (let i = 0; i < n; i++) {
    // Only characters still ON after the W rules can be brackets.
    if (t[i] !== 'ON') continue;
    const b = pairedBracket(codePoints[idx[i]]);
    if (!b) continue;
    if (b.kind === 'open') {
      if (stack.length === MAX_PAIRING_DEPTH) return;
      stack.push({ closer: canonicalBracket(b.pair), pos: i });
    } else {
      const closing = canonicalBracket(codePoints[idx[i]]);
      for (let s = stack.length - 1; s >= 0; s--) {
        if (stack[s].closer !== closing) continue;
        pairs.push([stack[s].pos, i]);
        stack.length = s;
        break;
      }
    }
  }
  pairs.sort((a, b) => a[0] - b[0]);

  const opposite = e === 'L' ? 'R' : 'L';
  for (const [open, close] of pairs) {
    let found: 'L' | 'R' | null = null;
    for (let i = open + 1; i < close; i++) {
      const d = n1Direction(t[i]);
      if (d === null) continue;
      if (d === e) { found = e; break; }
      found = opposite;
    }
    if (found === null) continue;

    let set: 'L' | 'R';
    if (found === e) {
      set = e;
    } else {
      // Enclosed text opposes the embedding: it only wins if the text leading
      // into the bracket opposed it too, otherwise the pair follows context.
      let prior: 'L' | 'R' = sos;
      for (let i = open - 1; i >= 0; i--) {
        const d = n1Direction(t[i]);
        if (d !== null) { prior = d; break; }
      }
      set = prior === opposite ? opposite : e;
    }
    t[open] = set;
    t[close] = set;
    // A combining mark on a bracket follows the bracket, not W1's answer —
    // and "combining mark" means what it was before W1 rewrote it.
    for (const at of [open, close]) {
      for (let i = at + 1; i < n; i++) {
        if (beforeW1[i] !== 'NSM') break;
        t[i] = set;
      }
    }
  }
}
