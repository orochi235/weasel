import { describe, expect, it } from 'vitest';
import { DIVIDER_HEIGHT, layoutBody, measureBody, rowHeights, type BodySpec, type MeasureRowText } from './body';
import { bodyLayoutOf } from './bodyRelayout';

const measure: MeasureRowText = (text) => ({ width: text.length * 10, height: 20 });
const spec = (rows: BodySpec['rows'], rest: Partial<BodySpec> = {}): BodySpec =>
  ({ outline: 'rect', rows, padding: 0, gap: 0, verticalAlign: 'top', ...rest });

describe('a divider row', () => {
  it('adds its fixed height and no width to the floor', () => {
    const floor = measureBody(spec([{ kind: 'label', text: 'abc' }, { kind: 'divider' }]), measure);
    expect(floor).toEqual({ minWidth: 30, minHeight: 20 + DIVIDER_HEIGHT });
  });

  it('spans the content box, not the padded one, short of it by its inset on each side', () => {
    const bounds = { x: 10, y: 20, width: 200, height: 100 };
    const [, rule, inset] = layoutBody(spec(
      [{ kind: 'label', text: 'a' }, { kind: 'divider' }, { kind: 'divider', inset: 6 }],
      { padding: 8 },
    ), bounds, measure);
    expect(rule).toMatchObject({ x: 10, width: 200, y: 48, height: DIVIDER_HEIGHT });
    expect(inset).toMatchObject({ x: 16, width: 188 });
  });

  it('spans an ellipse only as wide as the box its rows lay out in', () => {
    const bounds = { x: 0, y: 0, width: 200, height: 100 };
    const [rule] = layoutBody(spec([{ kind: 'divider' }], { outline: 'ellipse' }), bounds, measure);
    expect(rule!.x).toBeGreaterThan(0);
    expect(rule!.x + rule!.width).toBeLessThan(200);
  });

  it('is recorded with its place and inset, beside every row height', () => {
    const s = spec([{ kind: 'label', text: 'a' }, { kind: 'divider', inset: 2 }, { kind: 'field', label: 'k', value: 'v' }]);
    expect(rowHeights(s, measure)).toEqual([20, DIVIDER_HEIGHT, 20]);
    expect(bodyLayoutOf(s, { outline: 'rect' }, measure)).toEqual({
      body: { padding: 0, gap: 0, verticalAlign: 'top', rows: 3, heights: [20, DIVIDER_HEIGHT, 20], dividers: [{ index: 1, inset: 2 }] },
    });
  });
});
