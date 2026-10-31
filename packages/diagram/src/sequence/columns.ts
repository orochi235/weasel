/**
 * Where each participant's lifeline stands: far enough from its neighbors
 * that every message's text, every self-message's loop, and every note fits
 * between the lifelines it sits among.
 */
import { SEQ, headSize, type SeqMeasure } from './metrics';
import type { SeqStep, SequenceData } from './types';

/** A pull between two lifelines: their centers stand at least `room` apart. */
interface Need { a: number; b: number; room: number }

/** Every step, fragments' sections flattened in, in order. */
export function* flatSteps(steps: readonly SeqStep[]): Iterable<SeqStep> {
  for (const s of steps) {
    yield s;
    if (s.kind === 'fragment') for (const section of s.sections) yield* flatSteps(section.steps);
  }
}

/** The room a note needs between lifelines, or past the first or last. */
function noteNeeds(over: readonly number[], side: 'left' | 'right' | undefined, width: number, half: (i: number) => number): Need[] {
  const [a, b] = [Math.min(...over), Math.max(...over)];
  const room = width + SEQ.noteGap * 2;
  if (side === 'right') return [{ a, b: a + 1, room: room + half(a + 1) }];
  if (side === 'left') return [{ a: a - 1, b: a, room: room + half(a - 1) }];
  if (a === b) return [{ a: a - 1, b: a, room: width / 2 + half(a - 1) + SEQ.noteGap }, { a, b: a + 1, room: width / 2 + half(a + 1) + SEQ.noteGap }];
  return [{ a, b, room: width - SEQ.noteOverhang * 2 }];
}

/** The needs `data`'s steps put between lifelines, by index; `-1` and `n` stand for the margins. */
function needsOf(data: SequenceData, m: SeqMeasure, index: ReadonlyMap<string, number>, half: (i: number) => number): Need[] {
  const out: Need[] = [];
  const numbered = data.autonumber !== undefined;
  for (const s of flatSteps(data.steps)) {
    if (s.kind === 'message') {
      const a = index.get(s.from);
      const b = index.get(s.to);
      if (a === undefined || b === undefined) continue;
      const text = (s.text ?? '') === '' ? 0 : m.text(s.text!).width;
      const room = text + SEQ.textPad * 2 + SEQ.barWidth * 2 + (numbered ? SEQ.textPad * 2 : 0);
      if (a === b) out.push({ a, b: a + 1, room: SEQ.loopWidth + room + half(a + 1) });
      else out.push({ a: Math.min(a, b), b: Math.max(a, b), room });
    } else if (s.kind === 'note') {
      const over = s.over.map((id) => index.get(id)).filter((i): i is number => i !== undefined);
      if (over.length > 0) out.push(...noteNeeds(over, s.side, Math.max(SEQ.noteMinWidth, m.text(s.text).width + SEQ.notePad * 2), half));
    }
  }
  return out;
}

/** What {@link columnsOf} places. */
export interface Columns {
  /** Lifeline x by participant index. */
  x: number[];
  heads: { width: number; height: number }[];
  /** The rightmost x anything in a column reaches. */
  right: number;
}

/**
 * Lifeline centers, left to right from `left`: neighbors' heads apart by the
 * column gap, boxes' borders clear of their heads, and every need met by
 * spreading what it lacks over the gaps it spans, narrowest spans first.
 */
export function columnsOf(data: SequenceData, m: SeqMeasure, left: number): Columns {
  const ps = data.participants;
  const heads = ps.map((p) => headSize(p, m));
  const index = new Map(ps.map((p, i) => [p.id, i]));
  const boxOf = new Map<string, string>();
  for (const b of data.boxes ?? []) for (const id of b.members) if (!boxOf.has(id)) boxOf.set(id, b.id);
  const half = (i: number) => (heads[i]?.width ?? 0) / 2;
  const boxPad = (i: number) => (i >= 0 && i < ps.length && boxOf.has(ps[i]!.id) ? SEQ.boxPad : 0);
  // gaps[i] runs from lifeline i - 1 to lifeline i; gaps[0] from the left margin, gaps[n] to the right one.
  const gaps = Array.from({ length: ps.length + 1 }, (_, i) => {
    if (i === 0) return half(0) + boxPad(0);
    if (i === ps.length) return half(i - 1) + boxPad(i - 1);
    const split = boxOf.get(ps[i - 1]!.id) !== boxOf.get(ps[i]!.id);
    return half(i - 1) + half(i) + SEQ.columnGap + (split ? boxPad(i - 1) + boxPad(i) : 0);
  });
  const needs = needsOf(data, m, index, half).sort((p, q) => (p.b - p.a) - (q.b - q.a));
  for (const { a, b, room } of needs) {
    const lo = Math.max(a, -1) + 1;
    const hi = Math.min(b, ps.length) + 1;
    let have = 0;
    for (let i = lo; i < hi; i++) have += gaps[i]!;
    const lack = room - have;
    if (lack > 0) for (let i = lo; i < hi; i++) gaps[i]! += lack / (hi - lo);
  }
  const x: number[] = [];
  let at = left;
  for (let i = 0; i < ps.length; i++) {
    at += gaps[i]!;
    x.push(at);
  }
  return { x, heads, right: at + gaps[ps.length]! };
}
