/**
 * BD13 and X10 — grouping characters into the units the W/N/I rules run over.
 *
 * The unit is not the level run. An isolate is meant to be transparent to the
 * text around it, so a run ending in an isolate initiator continues at the run
 * beginning with that initiator's matching `PDI`, and the two are one sequence
 * with the isolate's contents excluded. An *embedding* does break the sequence.
 * That asymmetry is the whole of BD13, and getting it wrong turns every rule
 * downstream into "nearly right".
 */

import type { BidiClass } from './types';
import type { ExplicitResult } from './explicit';
import { matchingPDI } from './paragraph';

/** Direction a boundary is treated as having, per X10. */
export type Boundary = 'L' | 'R';

export interface IsolatingRunSequence {
  /** Indices into the original text, in logical order, X9-removals excluded. */
  indices: number[];
  level: number;
  sos: Boundary;
  eos: Boundary;
}

function isIsolateInitiator(c: BidiClass): boolean {
  return c === 'LRI' || c === 'RLI' || c === 'FSI';
}

/** Higher of two levels decides the boundary: odd reads right-to-left. */
function boundaryOf(a: number, b: number): Boundary {
  return Math.max(a, b) % 2 === 1 ? 'R' : 'L';
}

export function buildSequences(r: ExplicitResult): IsolatingRunSequence[] {
  const { classes, levels, removed, paragraphLevel } = r;
  const n = classes.length;

  const kept: number[] = [];
  for (let i = 0; i < n; i++) if (!removed[i]) kept.push(i);
  if (kept.length === 0) return [];

  // Match initiators to their PDIs once, over the original text — the pairing
  // is positional and does not care which characters X9 dropped.
  const pdiOf = new Map<number, number>();
  const initiatorOf = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    if (!isIsolateInitiator(classes[i])) continue;
    const m = matchingPDI(classes, i, n);
    if (m < n) {
      pdiOf.set(i, m);
      initiatorOf.set(m, i);
    }
  }

  // Level runs over the kept characters.
  interface Run { level: number; indices: number[] }
  const runs: Run[] = [];
  for (const i of kept) {
    const last = runs[runs.length - 1];
    if (last && last.level === levels[i]) last.indices.push(i);
    else runs.push({ level: levels[i], indices: [i] });
  }
  const runStartingAt = new Map<number, number>();
  runs.forEach((run, k) => runStartingAt.set(run.indices[0], k));

  const out: IsolatingRunSequence[] = [];
  const consumed = new Array<boolean>(runs.length).fill(false);

  for (let k = 0; k < runs.length; k++) {
    if (consumed[k]) continue;
    // A run opening with a PDI that closes an isolate is a continuation of an
    // earlier sequence, never the start of one.
    const first = runs[k].indices[0];
    if (classes[first] === 'PDI' && initiatorOf.has(first)) continue;

    const indices: number[] = [];
    let cur = k;
    for (;;) {
      consumed[cur] = true;
      indices.push(...runs[cur].indices);
      const lastIdx = runs[cur].indices[runs[cur].indices.length - 1];
      if (!isIsolateInitiator(classes[lastIdx])) break;
      const pdi = pdiOf.get(lastIdx);
      if (pdi === undefined) break;
      const next = runStartingAt.get(pdi);
      if (next === undefined || consumed[next]) break;
      cur = next;
    }

    const level = runs[k].level;
    const start = indices[0];
    const end = indices[indices.length - 1];

    let before = paragraphLevel;
    for (let i = start - 1; i >= 0; i--) {
      if (!removed[i]) { before = levels[i]; break; }
    }

    // An unmatched initiator ends its sequence against the paragraph rather
    // than against whatever text happens to follow it.
    let after = paragraphLevel;
    if (!(isIsolateInitiator(classes[end]) && !pdiOf.has(end))) {
      for (let i = end + 1; i < n; i++) {
        if (!removed[i]) { after = levels[i]; break; }
      }
    }

    out.push({
      indices,
      level,
      sos: boundaryOf(level, before),
      eos: boundaryOf(level, after),
    });
  }

  return out;
}
