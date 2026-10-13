import { describe, it, expect, beforeEach } from 'vitest';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { layoutAndPaint } from './testing/layoutAndPaint';
import type { LayoutRunsOpts } from './layoutOpts';
import { stubFetch, registerFixture, RUN_PLAIN } from './testing/fontFixtures';

beforeEach(() => {
  _resetFontRegistryForTests();
  stubFetch();
});

describe('layoutRuns — word wrap', () => {
  it('alignment shifts each line by (maxWidth - lineWidth) * factor', async () => {
    await registerFixture('inter', [{}]);
    const leftOut = layoutAndPaint([RUN_PLAIN('AB')], { maxWidth: 400, lineHeight: 1.2, align: 'left' });
    const centerOut = layoutAndPaint([RUN_PLAIN('AB')], { maxWidth: 400, lineHeight: 1.2, align: 'center' });
    const rightOut = layoutAndPaint([RUN_PLAIN('AB')], { maxWidth: 400, lineHeight: 1.2, align: 'right' });
    const leftX = leftOut.groups[0].quads[0].x0;
    const centerX = centerOut.groups[0].quads[0].x0;
    const rightX = rightOut.groups[0].quads[0].x0;
    expect(centerX).toBeGreaterThan(leftX);
    expect(rightX).toBeGreaterThan(centerX);
  });

  it('anchors center/right on the line width when no maxWidth box is given', async () => {
    await registerFixture('inter', [{}]);
    const at = (align: 'left' | 'center' | 'right') =>
      layoutAndPaint([RUN_PLAIN('AB')], { maxWidth: Infinity, lineHeight: 1.2, align });
    const first = (o: ReturnType<typeof at>) => o.groups[0].quads[0].x0;
    // Without a box, the anchor x is the text's left edge ('left'), midpoint
    // ('center'), or right edge ('right'). So center shifts left by half the
    // line width and right by the full line width, relative to 'left'.
    const shiftCenter = first(at('left')) - first(at('center'));
    const shiftRight = first(at('left')) - first(at('right'));
    expect(shiftCenter).toBeGreaterThan(0);
    expect(shiftRight).toBeCloseTo(2 * shiftCenter, 5);
  });
});

describe('layoutRuns — reading-order alignment', () => {
  const BOX = { maxWidth: 200, lineHeight: 1.2 };
  const xs = (o: ReturnType<typeof layoutAndPaint>) => o.lines[0].cells.map((c) => c.x);

  it('resolves start to the left edge under ltr', async () => {
    await registerFixture('inter', [{}]);
    const start = layoutAndPaint([RUN_PLAIN('AB')], { ...BOX, align: 'start', direction: 'ltr' });
    const left = layoutAndPaint([RUN_PLAIN('AB')], { ...BOX, align: 'left' });
    expect(xs(start)).toEqual(xs(left));
  });

  it('resolves start to the right edge under rtl', async () => {
    await registerFixture('inter', [{}]);
    const start = layoutAndPaint([RUN_PLAIN('AB')], { ...BOX, align: 'start', direction: 'rtl' });
    const right = layoutAndPaint([RUN_PLAIN('AB')], { ...BOX, align: 'right' });
    expect(xs(start)).toEqual(xs(right));
  });

  it('resolves end against direction the other way', async () => {
    await registerFixture('inter', [{}]);
    const endRtl = layoutAndPaint([RUN_PLAIN('AB')], { ...BOX, align: 'end', direction: 'rtl' });
    const left = layoutAndPaint([RUN_PLAIN('AB')], { ...BOX, align: 'left' });
    expect(xs(endRtl)).toEqual(xs(left));
  });

  it('leaves left and right absolute under rtl', async () => {
    await registerFixture('inter', [{}]);
    const leftRtl = layoutAndPaint([RUN_PLAIN('AB')], { ...BOX, align: 'left', direction: 'rtl' });
    const leftLtr = layoutAndPaint([RUN_PLAIN('AB')], { ...BOX, align: 'left', direction: 'ltr' });
    expect(xs(leftRtl)).toEqual(xs(leftLtr));
  });

  it('reads left to right when the caller omits direction and no engine is registered', async () => {
    await registerFixture('inter', [{}]);
    const bare = layoutAndPaint([RUN_PLAIN('AB')], { ...BOX, align: 'start' });
    const left = layoutAndPaint([RUN_PLAIN('AB')], { ...BOX, align: 'left' });
    expect(xs(bare)).toEqual(xs(left));
  });

  it('centers identically whatever the direction', async () => {
    await registerFixture('inter', [{}]);
    const rtl = layoutAndPaint([RUN_PLAIN('AB')], { ...BOX, align: 'center', direction: 'rtl' });
    const ltr = layoutAndPaint([RUN_PLAIN('AB')], { ...BOX, align: 'center', direction: 'ltr' });
    expect(xs(rtl)).toEqual(xs(ltr));
  });
});

describe('layoutRuns — trailing whitespace hangs', () => {
  it('centers a line on its ink, not on its trailing space', async () => {
    await registerFixture('inter', [{}]);
    const opts = { maxWidth: 200, lineHeight: 1.2, align: 'center' as const };
    const bare = layoutAndPaint([RUN_PLAIN('AB')], opts);
    const trailed = layoutAndPaint([RUN_PLAIN('AB ')], opts);
    // CSS hangs trailing whitespace: the visible text sits in the same place
    // whether or not the line ends in a space.
    expect(trailed.lines[0].cells[0].x).toBeCloseTo(bare.lines[0].cells[0].x, 10);
  });

  it('right-aligns a line on its ink, not on its trailing space', async () => {
    await registerFixture('inter', [{}]);
    const opts = { maxWidth: 200, lineHeight: 1.2, align: 'right' as const };
    const bare = layoutAndPaint([RUN_PLAIN('AB')], opts);
    const trailed = layoutAndPaint([RUN_PLAIN('AB ')], opts);
    expect(trailed.lines[0].cells[0].x).toBeCloseTo(bare.lines[0].cells[0].x, 10);
  });

  it('still gives the hung space a cell past the ink', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutAndPaint([RUN_PLAIN('AB ')], { maxWidth: 200, lineHeight: 1.2, align: 'center' });
    const cells = out.lines[0].cells;
    expect(cells).toHaveLength(3);
    expect(cells[2].cp).toBe(32);
    expect(cells[2].x).toBeGreaterThan(cells[1].x);
  });

  it('leaves a left-aligned line alone', async () => {
    await registerFixture('inter', [{}]);
    const opts = { maxWidth: 200, lineHeight: 1.2, align: 'left' as const };
    const bare = layoutAndPaint([RUN_PLAIN('AB')], opts);
    const trailed = layoutAndPaint([RUN_PLAIN('AB ')], opts);
    expect(trailed.lines[0].cells[0].x).toBeCloseTo(bare.lines[0].cells[0].x, 10);
  });
});

/**
 * A line that wraps keeps the space it broke at. Alignment already hangs that
 * space past the edge; `bounds` has to agree, or a caller scaling text to fit
 * measures a block wider than the box it just fitted into.
 */
describe('layoutRuns — hung trailing whitespace and bounds', () => {
  // 'AAAA BBBB' in the fixture atlas at size 32: 'AAAA' is 92 wide, 'BBBB' 88,
  // a space 8. A 96-wide box breaks between the words, so the first line ends
  // in the space it broke at.
  const AAAA = 92;
  const BBBB = 88;
  const SPACE = 8;
  const BOX = 96;

  it('leaves a wrapped line out of bounds.width by its hung space', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutAndPaint([RUN_PLAIN('AAAA BBBB')], { maxWidth: BOX, lineHeight: 1.1, align: 'left' });

    expect(out.lines).toHaveLength(2);
    expect(out.bounds.width).toBe(AAAA);
    expect(out.bounds.width).toBeLessThanOrEqual(BOX);
  });

  it('keeps the hung space in x1, which is the line-closing caret stop', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutAndPaint([RUN_PLAIN('AAAA BBBB')], { maxWidth: BOX, lineHeight: 1.1, align: 'left' });

    expect(out.lines[0].x1).toBe(AAAA + SPACE);
    expect(out.lines[1].x1).toBe(BBBB);
  });

  it('measures a line with no trailing space unchanged', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutAndPaint([RUN_PLAIN('AAAA')], { maxWidth: BOX, lineHeight: 1.1, align: 'left' });

    expect(out.lines).toHaveLength(1);
    expect(out.bounds.width).toBe(AAAA);
  });
});

describe('layoutRuns — alignWidth', () => {
  const at = (text: string, opts: Partial<LayoutRunsOpts>) =>
    layoutAndPaint([RUN_PLAIN(text)], { maxWidth: Infinity, lineHeight: 1.2, align: 'left', ...opts });

  it('aligns within alignWidth exactly as within a finite maxWidth', async () => {
    await registerFixture('inter', [{}]);
    for (const align of ['center', 'right'] as const) {
      const boxed = at('AB', { align, alignWidth: 400 });
      const wrapped = at('AB', { align, maxWidth: 400 });
      expect(boxed.lines[0].x0).toBeCloseTo(wrapped.lines[0].x0, 10);
    }
    expect(at('AB', { align: 'right', alignWidth: 400 }).lines[0].x1).toBeCloseTo(400, 10);
  });

  it('does not wrap at alignWidth', async () => {
    await registerFixture('inter', [{}]);
    expect(at('AB AB AB', { align: 'center', alignWidth: 40 }).lines).toHaveLength(1);
  });

  it('wraps at maxWidth and aligns within alignWidth when both are given', async () => {
    await registerFixture('inter', [{}]);
    const out = at('AB AB', { align: 'right', maxWidth: 60, alignWidth: 400 });
    const single = at('AB', { align: 'right', alignWidth: 400 });
    expect(out.lines).toHaveLength(2);
    for (const line of out.lines) expect(line.x0).toBeCloseTo(single.lines[0].x0, 10);
  });
});
