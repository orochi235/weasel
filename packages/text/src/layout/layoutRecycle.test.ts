/**
 * When the text caches hand a layout's arrays to the next layout: only once no
 * runs array files it, the structural list has let it go, and every caller
 * handed it asked to read rather than keep. A recycled array still read by
 * someone is text drawn with another label's glyphs, so the refusals matter
 * more than the reuse.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetFontRegistryForTests, _resetFallbackForTests } from '@weasel-js/font/test-seams';
import { registerFixture, stubFetch, RUN_PLAIN } from './testing/fontFixtures';
import { _resetArrayPoolForTests, pooledElements } from './arrayPool';
import { LineBox } from './layoutColumns';
import { cachedLayoutRuns, dropRuns, _resetLayoutCacheForTests, LAYOUT_CACHE_STRUCTURAL_LIMIT } from './layoutCache';
import { layoutRuns, type LaidOutRuns } from './layoutRuns';
import { cachedPaintRuns } from './paintCache';
import { paintRuns } from './paintRuns';

beforeEach(async () => {
  _resetFontRegistryForTests();
  _resetFallbackForTests();
  stubFetch();
  await registerFixture('inter', [{}]);
  _resetLayoutCacheForTests();
  _resetArrayPoolForTests();
});

const OPTS = { maxWidth: 400, lineHeight: 1.2, align: 'left' as const };
const numsOf = (laid: LaidOutRuns) => LineBox.columns(laid.lines[0])!.num;

/** Push every structural entry out with layouts nobody keeps or drops. */
function evictAll(tag: string): void {
  for (let i = 0; i < LAYOUT_CACHE_STRUCTURAL_LIMIT; i++) {
    cachedLayoutRuns([RUN_PLAIN(`${tag} filler ${i} and more`)], OPTS, 'read');
  }
}

/** A text drawn the way the renderer draws it: laid out and painted, read. */
function draw(text: string) {
  const runs = [RUN_PLAIN(text)];
  const laid = cachedLayoutRuns(runs, OPTS, 'read');
  const painted = cachedPaintRuns(laid, runs, {}, 'read');
  return { runs, laid, painted };
}

describe('recycling a layout', () => {
  it('gives a dropped, evicted layout its arrays to the next layout of its size', () => {
    const a = draw('AB 12');
    const nums = numsOf(a.laid);
    const quads = a.painted.groups.map((g) => g.quadData);
    dropRuns(a.runs);
    evictAll('x');
    const b = draw('BA 21');
    expect(numsOf(b.laid)).toBe(nums);
    expect(quads).toContain(b.painted.groups[0].quadData);
  });

  it('lays out and paints into reused arrays exactly as into fresh ones', () => {
    const a = draw('AB 12');
    const nums = numsOf(a.laid);
    dropRuns(a.runs);
    evictAll('x');
    const b = draw('BA 21');
    expect(numsOf(b.laid)).toBe(nums);
    const fresh = [RUN_PLAIN('BA 21')];
    const laid = layoutRuns(fresh, OPTS);
    expect(b.laid.lines.map((l) => l.cells)).toEqual(laid.lines.map((l) => l.cells));
    expect(b.laid.lines.map((l) => l.glyphs)).toEqual(laid.lines.map((l) => l.glyphs));
    expect(b.painted.groups.map((g) => [...g.quadData]))
      .toEqual(paintRuns(laid, fresh).groups.map((g) => [...g.quadData]));
  });

  it('keeps a layout any caller asked to keep', () => {
    const a = draw('AB 12');
    const kept = cachedLayoutRuns(a.runs, OPTS);
    const cells = kept.lines[0].cells.map((c) => ({ ...c }));
    const nums = numsOf(kept);
    dropRuns(a.runs);
    evictAll('x');
    const b = draw('BA 21');
    expect(numsOf(b.laid)).not.toBe(nums);
    expect(numsOf(kept)).toBe(nums);
    expect(kept.lines[0].cells).toEqual(cells);
  });

  it('keeps the quads of a painting a caller asked to keep', () => {
    const a = draw('AB 12');
    const painted = cachedPaintRuns(a.laid, a.runs);
    const quads = [...painted.groups[0].quadData];
    dropRuns(a.runs);
    evictAll('x');
    draw('BA 21');
    expect([...painted.groups[0].quadData]).toEqual(quads);
  });

  it('waits while the structural list still holds a dropped layout', () => {
    const a = draw('AB 12');
    const nums = numsOf(a.laid);
    dropRuns(a.runs);
    expect(pooledElements()).toBe(0);
    const b = draw('BA 21');
    expect(numsOf(b.laid)).not.toBe(nums);
    // Still found by content, and intact.
    expect(cachedLayoutRuns([RUN_PLAIN('AB 12')], OPTS, 'read')).toBe(a.laid);
    expect(numsOf(a.laid)).toBe(nums);
  });

  it('waits while another runs array files the same layout', () => {
    const a = draw('AB 12');
    const twin = [RUN_PLAIN('AB 12')];
    expect(cachedLayoutRuns(twin, OPTS, 'read')).toBe(a.laid);
    const nums = numsOf(a.laid);
    dropRuns(a.runs);
    evictAll('x');
    expect(cachedLayoutRuns(twin, OPTS, 'read')).toBe(a.laid);
    expect(numsOf(a.laid)).toBe(nums);
    dropRuns(twin);
    expect(pooledElements()).toBeGreaterThan(0);
  });

  it('lays out again when dropped runs are passed once more', () => {
    const a = draw('AB 12');
    dropRuns(a.runs);
    evictAll('x');
    const again = cachedLayoutRuns(a.runs, OPTS, 'read');
    expect(again).not.toBe(a.laid);
    expect(again.lines[0].cells).toEqual(layoutRuns([RUN_PLAIN('AB 12')], OPTS).lines[0].cells);
  });
});
