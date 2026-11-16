import { describe, expect, it } from 'vitest';
import { parseColor } from '@weasel-js/paint';
import { edgeColor, textFrameOf, textShadowBox } from './textFrame';

const BOX = { x: 10, y: 20, width: 100, height: 50 };
const PAPER = { paint: { kind: 'solid' as const, color: '#ffd6e0' } };

describe('textFrameOf', () => {
  it('draws nothing without a background', () => {
    expect(textFrameOf({ edge: { width: 1, shade: 0.2 }, shadow: { x: 0, y: 2, blur: 4, alpha: 0.2 } }, BOX))
      .toEqual({ shadow: null, edge: null });
  });

  it('sets the edge just inside the box, in a darker shade of the same hue', () => {
    const { edge } = textFrameOf({ background: PAPER, edge: { width: 2, shade: 0.3 } }, BOX);
    expect(edge!.path).toEqual({ kind: 'rect', x: 11, y: 21, width: 98, height: 48 });
    const [r, g, b] = parseColor(edge!.color);
    const [pr, pg, pb] = parseColor('#ffd6e0');
    // Darker, and still red-leaning pink: the channels keep their order.
    expect(r).toBeLessThan(pr);
    expect(r).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(g);
    expect(pr).toBeGreaterThan(pb);
    expect(pb).toBeGreaterThan(pg);
  });

  it('gives a gradient background no edge, having no one color to shade', () => {
    const gradient = { paint: { kind: 'linear' as const, stops: [{ offset: 0, color: '#fff' }, { offset: 1, color: '#000' }] } };
    expect(edgeColor(gradient as never, 0.2)).toBeNull();
  });

  it('casts a shadow under the box, reaching half its blur past the offset box', () => {
    const d = { background: PAPER, shadow: { x: 0, y: 2, blur: 6, alpha: 0.2 } };
    expect(textFrameOf(d, BOX).shadow!.paths.length).toBeGreaterThan(1);
    expect(textShadowBox(d, BOX)).toEqual({ x: 7, y: 19, width: 106, height: 56 });
    expect(textShadowBox({ shadow: d.shadow }, BOX)).toBeNull();
  });
});
