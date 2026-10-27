/**
 * A run's `rotate` turns each of its glyphs about its own pen on the baseline:
 * the layout carries the angle on each placed glyph, painting carries it on
 * each quad and outline glyph, and the glyphs keep their places along the line.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetFontRegistryForTests, _resetFallbackForTests } from '@weasel-js/font/test-seams';
import { registerFixture, stubFetch, RUN_PLAIN } from './testing/fontFixtures';
import { layoutRuns } from './layoutRuns';
import { cachedLayoutRuns } from './layoutCache';
import { paintRuns } from './paintRuns';
import { resolveRuns } from '../runs/resolveRuns';
import { resolveTextStyle } from '../textStyle';
import { _resetLayoutCacheForTests } from '../test-seams';

beforeEach(async () => {
  _resetFontRegistryForTests();
  _resetFallbackForTests();
  _resetLayoutCacheForTests();
  stubFetch();
  await registerFixture('inter', [{}]);
});

const OPTS = { maxWidth: Infinity, lineHeight: 1.2, align: 'left' as const };

describe('glyph rotation', () => {
  it('resolves a run\'s turn, and leaves an upright run without one', () => {
    const style = resolveTextStyle({ fontFamily: 'inter' });
    const [turned, upright, bad] = resolveRuns([{ text: 'a', rotate: 30 }, { text: 'b', rotate: 0 }, { text: 'c', rotate: NaN }], style);
    expect(turned.rotate).toBe(30);
    expect('rotate' in upright).toBe(false);
    expect('rotate' in bad).toBe(false);
  });

  it('turns each glyph of the run and moves none of them', () => {
    const upright = layoutRuns([RUN_PLAIN('AB'), RUN_PLAIN('C')], OPTS);
    const turned = layoutRuns([{ ...RUN_PLAIN('AB'), rotate: 45 }, RUN_PLAIN('C')], OPTS);
    const [a, b, c] = turned.lines[0].glyphs;
    expect([a.rotate, b.rotate, c.rotate]).toEqual([45, 45, 0]);
    expect(turned.lines[0].glyphs.map((g) => [g.x, g.baselineY]))
      .toEqual(upright.lines[0].glyphs.map((g) => [g.x, g.baselineY]));
    expect(turned.bounds).toEqual(upright.bounds);
  });

  it('lays out again when only the turn changed', () => {
    const before = cachedLayoutRuns([RUN_PLAIN('A')], OPTS);
    const after = cachedLayoutRuns([{ ...RUN_PLAIN('A'), rotate: 90 }], OPTS);
    expect(after).not.toBe(before);
    expect(after.lines[0].glyphs[0].rotate).toBe(90);
  });

  it('puts each quad\'s pen and turn beside its corners', () => {
    const runs = [{ ...RUN_PLAIN('AB'), rotate: -20 }];
    const laid = layoutRuns(runs, OPTS);
    const [group] = paintRuns(laid, runs).groups;
    const glyphs = laid.lines[0].glyphs;
    expect(group.quads.map((q) => [q.penX, q.rotate])).toEqual(glyphs.map((g) => [g.x, -20]));
    // The corners stay the upright box: the turn is applied where they are drawn.
    const upright = paintRuns(layoutRuns([RUN_PLAIN('AB')], OPTS), [RUN_PLAIN('AB')]).groups[0];
    expect(group.quads.map((q) => [q.x0, q.y0, q.x1, q.y1])).toEqual(upright.quads.map((q) => [q.x0, q.y0, q.x1, q.y1]));
  });
});
