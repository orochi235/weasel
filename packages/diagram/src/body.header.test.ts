import { describe, expect, it } from 'vitest';
import { HEADER_PAD, bodyTrait, canvasMeasure, layoutBody, measureBody, rowHeights, type BodySpec, type MeasureRowText } from './body';
import { bodyLayoutOf, recordedLayout } from './bodyRelayout';
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
    expect(bodyTrait(s, { x: 0, y: 0, width: 100, height: 80 }, measure).header).toEqual({ height: BAND });
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
