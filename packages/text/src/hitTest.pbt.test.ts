/**
 * Properties of `caretIndexAt` on wrapped mixed-script text: every answer is a grapheme boundary inside the
 * text, a caret moves only forward along a left-to-right line, and a point in either half of a character's
 * cell answers that character's start or end.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { bidi } from '@weasel-js/bidi';
import { caretIndexAt } from './hitTest';
import { layoutTextPose } from './layout/textPoseLayout';
import { registerBidi, registeredBidi } from './layout/bidiRegistry';
import type { LaidOutCell } from './layout/layoutRuns';
import type { TextPose } from './pose';
import { mixedText, registerPropertyFont, runs, segmenterEnds, tally, timeoutFor } from './pbt.fixture';

const RUNS = 150;

beforeAll(registerPropertyFont);

const pose = fc.record({
  text: mixedText(16),
  width: fc.integer({ min: 40, max: 400 }),
  letterSpacing: fc.constantFrom(0, 0, 2),
}).map(({ text, width, letterSpacing }): TextPose => ({
  x: 10, y: 20, width, height: 300, text, style: { fontFamily: 'inter', fontSize: 32, wrap: true, letterSpacing },
}));

const boundaries = (text: string): Set<number> => new Set([0, ...segmenterEnds(text)]);

/** A line's cells grouped by grapheme cluster, with the extent of the ones that take room. */
function clusters(cells: readonly LaidOutCell[]): { x0: number; x1: number; src: number; end: number }[] {
  const out: { x0: number; x1: number; src: number; end: number }[] = [];
  let group: LaidOutCell[] = [];
  for (const c of cells) {
    group.push(c);
    if (!c.clusterEnd) continue;
    const wide = group.filter((g) => g.advance > 0);
    if (wide.length > 0) {
      out.push({
        x0: Math.min(...wide.map((g) => g.x)), x1: Math.max(...wide.map((g) => g.x + g.advance)),
        src: Math.min(...group.map((g) => g.srcIndex)), end: Math.max(...group.map((g) => g.srcEnd)),
      });
    }
    group = [];
  }
  return out;
}

function inRangeOnBoundaries(): void {
  const t = tally();
  fc.assert(fc.property(pose, fc.integer({ min: -600, max: 4700 }).map((n) => n / 10), fc.integer({ min: -200, max: 3400 }).map((n) => n / 10), (p, x, y) => {
    const at = caretIndexAt(x, y, p);
    expect(at >= 0 && at <= p.text.length, `${at} in ${JSON.stringify(p.text)}`).toBe(true);
    const { lines } = layoutTextPose(p).laid;
    // A wrap can open a line between a space and a mark or ZWJ on it, which is open in docs/unruled.md.
    const lineStarts = lines.map((l) => l.cells[0]?.srcIndex);
    expect(boundaries(p.text).has(at) || lineStarts.includes(at), `${at} splits a cluster of ${JSON.stringify(p.text)}`).toBe(true);
    const levels = lines.flatMap((l) => l.cells.map((c) => c.level));
    t.count(levels.some((v) => v % 2 === 1) ? 'right to left' : 'left to right');
  }), runs(RUNS));
  t.atLeast('left to right', 20);
  if (registeredBidi()) t.atLeast('right to left', 20);
}

describe('caretIndexAt, property', () => {
  it('answers a grapheme boundary inside the text, wherever the point is', inRangeOnBoundaries, timeoutFor(RUNS, 20));

  it('moves only forward as the point moves right along a line', () => {
    const t = tally();
    fc.assert(fc.property(pose, fc.array(fc.integer({ min: -10, max: 110 }).map((n) => n / 100), { minLength: 2, maxLength: 8 }), (p, fs) => {
      const { laid, x: dx, y: dy } = layoutTextPose(p);
      for (const line of laid.lines) {
        const y = dy + (line.y0 + line.y1) / 2;
        const span = line.x1 - line.x0;
        const answers = [...fs].sort((a, b) => a - b).map((f) => caretIndexAt(dx + line.x0 + f * span, y, p));
        for (let i = 1; i < answers.length; i++) expect(answers[i]!).toBeGreaterThanOrEqual(answers[i - 1]!);
        if (new Set(answers).size > 1) t.count('moved');
      }
    }), runs(RUNS));
    t.atLeast('moved', 30);
  }, timeoutFor(RUNS, 30));

  it('answers a cluster\'s start from its left half and its end from its right half', () => {
    const t = tally();
    fc.assert(fc.property(pose, (p) => {
      const { laid, x: dx, y: dy } = layoutTextPose(p);
      for (const line of laid.lines) {
        const y = dy + (line.y0 + line.y1) / 2;
        for (const c of clusters(line.cells)) {
          if (c.x1 - c.x0 < 1) continue;
          t.count('cluster');
          expect(caretIndexAt(dx + c.x0 + (c.x1 - c.x0) * 0.25, y, p), `left of ${c.src} in ${JSON.stringify(p.text)}`).toBe(c.src);
          expect(caretIndexAt(dx + c.x0 + (c.x1 - c.x0) * 0.75, y, p), `right of ${c.src} in ${JSON.stringify(p.text)}`).toBe(c.end);
        }
      }
    }), runs(RUNS));
    t.atLeast('cluster', 200);
  }, timeoutFor(RUNS, 30));
});

describe('caretIndexAt with a bidi engine, property', () => {
  let unregister = (): void => {};
  beforeAll(() => { unregister = registerBidi(bidi); });
  afterAll(() => unregister());

  it('answers a grapheme boundary inside the text, wherever the point is', inRangeOnBoundaries, timeoutFor(RUNS, 20));
});
