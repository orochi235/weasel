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
import {
  cachedLayoutRuns, dropRuns, _resetLayoutCacheForTests, LAYOUT_CACHE_STRUCTURAL_LIMIT, LAYOUT_CACHE_VARIANT_LIMIT,
} from './layoutCache';
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

/** Fill the structural list behind `a` so that the next layout evicts it,
 *  and takes what it recycles. */
function fillBehind(tag: string): void {
  for (let i = 0; i < LAYOUT_CACHE_STRUCTURAL_LIMIT - 1; i++) {
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

  it('paints dropped runs passed once more for themselves, not from the entry the next runs took', () => {
    const a = draw('AB 12');
    dropRuns(a.runs);
    const b = draw('CD 34');
    const laid = cachedLayoutRuns(a.runs, OPTS, 'read');
    const painted = cachedPaintRuns(laid, a.runs, {}, 'read');
    expect(painted).not.toBe(b.painted);
    expect(painted.groups.map((g) => g.quads)).toEqual(paintRuns(laid, a.runs).groups.map((g) => g.quads));
  });

  it('paints runs for themselves when the result they were painted on has been handed to other runs', () => {
    const a = draw('AB 12');
    // An eighth set of options sends every layout of a.runs away while its
    // painting stays filed under it. The others are kept, so only a.laid
    // recycles, evicted by the next layout to miss, which takes its result.
    for (let k = 1; k <= LAYOUT_CACHE_VARIANT_LIMIT; k++) cachedLayoutRuns(a.runs, { ...OPTS, maxWidth: 500 + k });
    for (let i = 0; i < LAYOUT_CACHE_STRUCTURAL_LIMIT - 1 - LAYOUT_CACHE_VARIANT_LIMIT; i++) {
      cachedLayoutRuns([RUN_PLAIN(`x filler ${i} and more`)], OPTS, 'read');
    }
    const narrow = { ...OPTS, maxWidth: 401 };
    const red = [{ ...RUN_PLAIN('AB 12'), fill: { paint: { kind: 'solid' as const, color: '#f00' } } }];
    const laid = cachedLayoutRuns(red, narrow, 'read');
    expect(laid).toBe(a.laid);
    const painted = cachedPaintRuns(laid, red, {}, 'read');
    // Found by content: the same result, now red's.
    expect(cachedLayoutRuns(a.runs, narrow, 'read')).toBe(laid);
    const again = cachedPaintRuns(laid, a.runs, {}, 'read');
    expect(again).not.toBe(painted);
    expect(again.groups[0].fill?.paint).toEqual({ kind: 'solid', color: '#000' });
  });

  it('lays out again when dropped runs are passed once more', () => {
    const a = draw('AB 12');
    dropRuns(a.runs);
    evictAll('x');
    const again = cachedLayoutRuns(a.runs, OPTS, 'read');
    expect(again).not.toBe(a.laid);
    expect(again.lines[0].cells).toEqual(layoutRuns([RUN_PLAIN('AB 12')], OPTS).lines[0].cells);
  });

  it('refills a recycled layout\'s result, line boxes and its paintings\' groups', () => {
    const a = draw('AB 12');
    const box = a.laid.lines[0];
    const group = a.painted.groups[0];
    dropRuns(a.runs);
    fillBehind('x');
    const b = draw('BA 21');
    expect(b.laid).toBe(a.laid);
    expect(b.laid.lines[0]).toBe(box);
    expect(b.painted.groups).toContain(group);
  });

  it('rebuilds a refilled line box\'s views, and leaves a group whose quads were read', () => {
    const a = draw('AB 12');
    expect(a.laid.lines[0].cells).toHaveLength(5);
    const group = a.painted.groups[0];
    expect(group.quads.length).toBeGreaterThan(0);
    dropRuns(a.runs);
    fillBehind('x');
    const b = draw('BAB');
    const fresh = layoutRuns([RUN_PLAIN('BAB')], OPTS);
    expect(b.laid.lines[0].cells).toEqual(fresh.lines[0].cells);
    expect(b.laid.lines[0].glyphs).toEqual(fresh.lines[0].glyphs);
    expect(b.laid.bounds).toEqual(fresh.bounds);
    expect(b.painted.groups).not.toContain(group);
    expect(b.painted.groups.map((g) => g.quads)).toEqual(paintRuns(fresh, [RUN_PLAIN('BAB')]).groups.map((g) => g.quads));
  });
});
