import { describe, expect, it } from 'vitest';
import { HEADER_ASIDE_GAP, HEADER_PAD, bodyTrait, canvasMeasure, layoutBody, measureBody, rowHeights, type BodySpec, type MeasureRowText } from './body';
import { bodyLayoutOf, recordedLayout } from './bodyRelayout';
import { faceCapCenter } from './faceCapCenter';
import { capCenterFrom } from './rowMeasure';
import { textFace } from './rowStyle';

const measure: MeasureRowText = (text) => ({ width: text.length * 10, height: 20 });
const spec = (rows: BodySpec['rows'], rest: Partial<BodySpec> = {}): BodySpec =>
  ({ outline: 'rect', rows, padding: 8, gap: 4, verticalAlign: 'top', ...rest });
const BAND = 20 + HEADER_PAD * 2;

describe('a header row', () => {
  it('adds its band above the rows, and is as wide as its text and the padding on both sides', () => {
    const floor = measureBody(spec([{ kind: 'header', text: 'abcdefghij' }, { kind: 'label', text: 'ab' }]), measure);
    expect(floor).toEqual({ minWidth: 100 + 16, minHeight: BAND + 20 + 16 });
  });

  it('is only its band when it is the only row', () => {
    expect(measureBody(spec([{ kind: 'header', text: 'ab' }]), measure)).toEqual({ minWidth: 36, minHeight: BAND });
  });

  it('sits flush with the bounds, its text at the padding from the left, the rows below its band', () => {
    const bounds = { x: 10, y: 20, width: 200, height: 100 };
    const [head, row] = layoutBody(spec([{ kind: 'header', text: 'T' }, { kind: 'label', text: 'a' }]), bounds, measure);
    expect(head).toMatchObject({ index: 0, x: 18, y: 20 + HEADER_PAD, width: 184, height: 20 });
    expect(row).toMatchObject({ index: 1, x: 18, y: 20 + BAND + 8, width: 184 });
  });

  it('does not take a diamond\'s inset', () => {
    const bounds = { x: 0, y: 0, width: 200, height: 100 };
    const [head] = layoutBody(spec([{ kind: 'header', text: 'T' }, { kind: 'label', text: 'a' }], { outline: 'diamond' }), bounds, measure);
    expect(head).toMatchObject({ x: 8, y: HEADER_PAD });
  });

  it('puts its band on the trait', () => {
    const s = spec([{ kind: 'header', text: 'T' }, { kind: 'label', text: 'a' }]);
    expect(bodyTrait(s, { x: 0, y: 0, width: 100, height: 80 }, measure).header).toEqual({ height: BAND, text: { y: HEADER_PAD, height: 20 } });
    expect(bodyTrait(spec([{ kind: 'label', text: 'a' }]), { x: 0, y: 0, width: 100, height: 80 }, measure)).not.toHaveProperty('header');
  });

  it('is refused anywhere but first', () => {
    expect(() => measureBody(spec([{ kind: 'label', text: 'a' }, { kind: 'header', text: 'T' }]), measure)).toThrow(/first row/);
  });

  it('lays out again from its recorded heights as it was measured', () => {
    const s = spec([{ kind: 'header', text: 'T' }, { kind: 'label', text: 'a' }, { kind: 'divider' }]);
    const bounds = { x: 0, y: 0, width: 120, height: 90 };
    const trait = { ...bodyTrait(s, bounds, measure), ...bodyLayoutOf(s, { outline: 'rect' }, measure) };
    expect(trait.body?.heights).toEqual(rowHeights(s, measure));
    const again = recordedLayout(trait, bounds)!.map(({ x, y, width, height }) => ({ x, y, width, height }));
    expect(again).toEqual(layoutBody(s, bounds, measure).map(({ x, y, width, height }) => ({ x, y, width, height })));
  });
});

describe('a header row\'s text in its band', () => {
  // Ascent and descent filling the 1.2 line exactly put the baseline 9 below the top of a size-10
  // line; a 0.7 cap height then centers the caps 5.5 below it.
  const METRICS = { ascent: 0.9, descent: 0.3, capHeight: 0.7 };
  const capped: MeasureRowText = (text) => ({ width: text.length * 10, height: 12, capCenter: capCenterFrom(METRICS, 10) });
  const bounds = { x: 0, y: 30, width: 120, height: 80 };
  const s = spec([{ kind: 'header', text: 'TITLE' }, { kind: 'label', text: 'a' }]);

  it('sits with its caps centered in the band, which stays its line plus the pad on each side', () => {
    expect(capCenterFrom(METRICS, 10)).toBeCloseTo(5.5);
    const [head] = layoutBody(s, bounds, capped);
    const band = 12 + HEADER_PAD * 2;
    expect(head!.y - bounds.y).toBeCloseTo(band / 2 - 5.5);
    expect(head!.height).toBe(12);
    const baseline = head!.y + 9;
    expect((baseline + (baseline - 7)) / 2).toBeCloseTo(bounds.y + band / 2);
    expect(bodyTrait(s, bounds, capped).header).toEqual({ height: band, text: { y: band / 2 - 5.5, height: 12 } });
    expect(measureBody(s, capped).minHeight - measureBody(spec([{ kind: 'label', text: 'a' }]), capped).minHeight).toBe(band);
  });

  it('centers its line box when the face\'s metrics are unknown', () => {
    const [head] = layoutBody(s, bounds, measure);
    expect(head!.y - bounds.y).toBe(HEADER_PAD);
  });

  it('keeps that place when laid out again from what its trait records', () => {
    const trait = { ...bodyTrait(s, bounds, capped), ...bodyLayoutOf(s, { outline: 'rect' }, capped) };
    expect(recordedLayout(trait, bounds)![0]!.y).toBeCloseTo(layoutBody(s, bounds, capped)[0]!.y);
  });

  it('takes its own pad above and below', () => {
    const tight = spec([{ kind: 'header', text: 'T', pad: 1 }]);
    expect(measureBody(tight, measure).minHeight).toBe(22);
    expect(layoutBody(tight, bounds, measure)[0]).toMatchObject({ y: bounds.y + 1, height: 20 });
  });

  it('is centered from a canvas\'s font and glyph bounds by canvasMeasure', () => {
    const ctx = { font: '', measureText: () => ({ width: 10, fontBoundingBoxAscent: 9, fontBoundingBoxDescent: 3, actualBoundingBoxAscent: 7 }) };
    expect(canvasMeasure(ctx)('T', { fontSize: 10 }).capCenter).toBeCloseTo(5.5);
    const bare = { font: '', measureText: () => ({ width: 10 }) };
    expect(canvasMeasure(bare)('T', { fontSize: 10 })).not.toHaveProperty('capCenter');
  });

  it('is centered from a registered face\'s metrics', () => {
    const seen: unknown[] = [];
    const lookup = (family: string, weight: number, style: string) => { seen.push([family, weight, style]); return METRICS; };
    expect(faceCapCenter({ fontFamily: 'Oswald', fontSize: 10, weight: 400 }, lookup)).toBeCloseTo(5.5);
    expect(seen).toEqual([['Oswald', 400, 'normal']]);
    expect(faceCapCenter({ fontFamily: 'Oswald', fontSize: 10 }, () => ({ ascent: 0.9, descent: 0.3 }))).toBeUndefined();
    expect(faceCapCenter({ fontSize: 10 }, lookup)).toBeUndefined();
  });
});

describe('a header\'s aside', () => {
  const s = spec([{ kind: 'header', text: 'TITLE', aside: 'v2' }, { kind: 'label', text: 'a' }]);
  const bounds = { x: 10, y: 30, width: 200, height: 80 };

  it('widens the floor by the gap and its own width', () => {
    expect(measureBody(s, measure).minWidth).toBe(50 + HEADER_ASIDE_GAP + 20 + 16);
  });

  it('sits against the right padding on the title\'s line, and narrows the title\'s box to clear it', () => {
    const [head] = layoutBody(s, bounds, measure);
    expect(head!.aside).toEqual({ x: 210 - 8 - 20, y: head!.y, width: 20, height: head!.height });
    expect(head!.x + head!.width).toBe(head!.aside!.x - HEADER_ASIDE_GAP);
  });

  it('is recorded on the band, and laid out again from it', () => {
    const trait = { ...bodyTrait(s, bounds, measure), ...bodyLayoutOf(s, { outline: 'rect' }, measure) };
    expect(trait.header?.aside).toEqual({ width: 20 });
    const wider = { ...bounds, width: 300 };
    expect(recordedLayout(trait, wider)![0]!.aside).toEqual(layoutBody(s, wider, measure)[0]!.aside);
  });
});

describe('tracking', () => {
  it('widens what canvasMeasure measures by its em per character', () => {
    const ctx = { font: '', measureText: () => ({ width: 30 }) };
    expect(canvasMeasure(ctx)('abc', { fontSize: 10, tracking: 0.1 }).width).toBeCloseTo(33);
  });

  it('sets a numeric weight in the font canvasMeasure measures with', () => {
    const ctx = { font: '', measureText: () => ({ width: 30 }) };
    canvasMeasure(ctx)('abc', { fontSize: 10, weight: 300, fontFamily: 'Oswald' });
    expect(ctx.font).toMatch(/^300 10px /);
  });

  it('widens a header measured with no measure at all', () => {
    const plain = measureBody(spec([{ kind: 'header', text: 'abcd', style: { fontSize: 10 } }])).minWidth;
    const tracked = measureBody(spec([{ kind: 'header', text: 'abcd', style: { fontSize: 10, tracking: 0.2 } }])).minWidth;
    expect(tracked - plain).toBeCloseTo(8);
  });

  it('reaches the scene text as letter spacing in world units, with the weight', () => {
    expect(textFace({ tracking: 0.1, weight: 300 }, { fontFamily: 'Oswald', fontSize: 20 }))
      .toEqual({ fontFamily: 'Oswald', fontSize: 20, fontWeight: 300, letterSpacing: 2 });
  });
});
