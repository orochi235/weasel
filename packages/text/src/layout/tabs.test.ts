import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { layoutRuns, type LayoutRunsOpts } from './layoutRuns';
import { cachedLayoutRuns } from './layoutCache';
import type { ResolvedRun } from '../runs/resolveRuns';
import { tabAdvance } from './tabStops';
import { layoutTextPose } from './textPoseLayout';
import { measureTextBounds } from '../measure/measureTextBounds';

beforeEach(async () => {
  _resetFontRegistryForTests();
  global.fetch = vi.fn().mockImplementation((url: string) => (url.endsWith('.json')
    ? Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) })
    : Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(['PNG'], { type: 'image/png' })) })
  )) as typeof fetch;
  global.createImageBitmap = vi.fn().mockResolvedValue({
    width: 512, height: 512, close: vi.fn(),
  } as unknown as ImageBitmap);
  await registerFont('inter', {}, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
});

const RUN = (text: string, more: Partial<ResolvedRun> = {}): ResolvedRun => ({
  text, fontFamily: 'inter', fontSize: 32, fontWeight: 400, fontStyle: 'normal',
  fill: { kind: 'solid', color: '#000' }, letterSpacing: 0,
  underline: false, strikethrough: false, overline: false, baselineShift: 0,
  ...more,
});
const OPTS: LayoutRunsOpts = { maxWidth: Infinity, lineHeight: 1.2, align: 'left' };

/** The advance of one space at the run's size, read off a laid-out one. */
function spaceAdvance(): number {
  return layoutRuns([RUN('A A')], OPTS).lines[0].cells[1].advance;
}

describe('tabAdvance', () => {
  it('runs to the next multiple of the stop', () => {
    expect(tabAdvance(0, 80, 5)).toBe(80);
    expect(tabAdvance(30, 80, 5)).toBe(50);
    expect(tabAdvance(80, 80, 5)).toBe(80);
  });

  it('skips a stop closer than the minimum, as CSS does under half a space', () => {
    expect(tabAdvance(78, 80, 5)).toBe(82);
  });

  it('is zero for a zero stop', () => {
    expect(tabAdvance(30, 0, 5)).toBe(0);
  });
});

describe('layoutRuns — tabs', () => {
  it('advances a tab to the next multiple of eight spaces by default', () => {
    const stop = spaceAdvance() * 8;
    const [a, tab, b] = layoutRuns([RUN('A\tB')], OPTS).lines[0].cells;
    expect(a.x).toBe(0);
    expect(tab.cp).toBe(9);
    expect(tab.x + tab.advance).toBeCloseTo(stop, 10);
    expect(b.x).toBeCloseTo(stop, 10);
  });

  it('lines up text after tabs whatever came before them', () => {
    const wide = { ...OPTS, tabSize: 40 };
    const one = layoutRuns([RUN('A\tB')], wide).lines[0].cells;
    const two = layoutRuns([RUN('AAA\tB')], wide).lines[0].cells;
    expect(two[3].x).toBeGreaterThan(one[1].x);
    expect(two[4].x).toBeCloseTo(one[2].x, 10);
  });

  it('takes its stops from `tabSize`, in spaces', () => {
    const cells = layoutRuns([RUN('\t\tB')], { ...OPTS, tabSize: 2 }).lines[0].cells;
    expect(cells[2].x).toBeCloseTo(spaceAdvance() * 4, 10);
  });

  it('measures stops from the start of each line', () => {
    const out = layoutRuns([RUN('AAA\n\tB')], OPTS);
    expect(out.lines[1].cells[1].x).toBeCloseTo(spaceAdvance() * 8, 10);
  });

  it('never looks a tab up as a glyph', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = layoutRuns([RUN('A\tB')], OPTS);
    expect(out.groups[0].quads).toHaveLength(2);
    expect(out.lines[0].cells[1].drawsInk).toBe(false);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('counts a tab in the width the line reports and wraps by', () => {
    const stop = spaceAdvance() * 8;
    const bWidth = layoutRuns([RUN('B')], OPTS).bounds.width;
    expect(layoutRuns([RUN('A\tB')], OPTS).bounds.width).toBeCloseTo(stop + bWidth, 10);
    // `B` sits past the tab stop, so a box narrower than that has to wrap it.
    const wrapped = layoutRuns([RUN('A\tB')], { ...OPTS, maxWidth: stop + bWidth / 2 });
    expect(wrapped.lines).toHaveLength(2);
    expect(wrapped.lines[1].cells[0].cp).toBe(66);
    const fits = layoutRuns([RUN('A\tB')], { ...OPTS, maxWidth: stop + bWidth + 1 });
    expect(fits.lines).toHaveLength(1);
  });

  it('hangs a trailing tab past the aligned edge, as it does a space', () => {
    const opts: LayoutRunsOpts = { maxWidth: 400, lineHeight: 1.2, align: 'right' };
    const bare = layoutRuns([RUN('AB')], opts);
    const trailed = layoutRuns([RUN('AB\t')], opts);
    expect(trailed.lines[0].cells[0].x).toBeCloseTo(bare.lines[0].cells[0].x, 10);
  });

  it('takes the tab size a text style states, for a pose and for a measurement', () => {
    const space = spaceAdvance();
    const style = { fontFamily: 'inter', fontSize: 32, tabSize: 2 };
    const { laid } = layoutTextPose({ x: 0, y: 0, width: 400, height: 40, text: '\tB', style });
    expect(laid.lines[0].cells[1].x).toBeCloseTo(space * 2, 10);
    const b = measureTextBounds('B', style).width;
    expect(measureTextBounds('\tB', style).width).toBeCloseTo(space * 2 + b, 10);
    expect(measureTextBounds('\tB', { ...style, tabSize: undefined }).width).toBeCloseTo(space * 8 + b, 10);
  });

  it('keys the cached layout on the tab size', () => {
    const runs = [RUN('A\tB')];
    const eight = cachedLayoutRuns(runs, OPTS);
    const four = cachedLayoutRuns(runs, { ...OPTS, tabSize: 4 });
    expect(four.lines[0].cells[2].x).toBeCloseTo(eight.lines[0].cells[2].x / 2, 10);
  });
});
