/**
 * Property tests of a CSS `box-shadow` list cast by a HUD box: each layer goes under the face or, inset, over it, the
 * first layer topmost, in its own color or the current one; a hard layer of a square box covers exactly the box
 * moved by its offset and grown by its spread, and an inset one exactly the box less its inner box.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { pointInPath, type Path } from '@weasel-js/geom';
import type { BoxShadow } from '@weasel-js/theme';
import { boxShadowCommands } from './boxShadow';
import { runs, tally } from './pbt.fixture';

const RUNS = 300;

const layer: fc.Arbitrary<BoxShadow> = fc.record({
  inset: fc.boolean(),
  x: fc.integer({ min: -12, max: 12 }), y: fc.integer({ min: -12, max: 12 }),
  blur: fc.integer({ min: 0, max: 20 }), spread: fc.integer({ min: -8, max: 12 }),
  color: fc.constantFrom('#000000', '#ff000080', 'currentColor', 'red'),
});
const box = fc.record({ x: fc.integer({ min: -50, max: 50 }), y: fc.integer({ min: -50, max: 50 }), w: fc.integer({ min: 1, max: 40 }), h: fc.integer({ min: 1, max: 40 }) });

const numbers = (v: unknown): number[] => {
  const out: number[] = [];
  JSON.stringify(v, (_k, x) => { if (typeof x === 'number') out.push(x); return x; });
  return out;
};
const colorOf = (cmd: unknown): string => (cmd as { children: { fill: { paint: { color: string } } }[] }).children[0]!.fill.paint.color;
const pathsOf = (cmd: unknown): Path[] => (cmd as { children: { path: Path }[] }).children.map((c) => c.path);

describe('boxShadowCommands', () => {
  it('puts outer layers under and inset ones over, last first, each in its color, all finite', () => {
    fc.assert(fc.property(box, fc.integer({ min: 0, max: 12 }), fc.array(layer, { maxLength: 5 }), (b, radius, layers) => {
      const { under, over } = boxShadowCommands(b, radius, layers, '#123456');
      const want = (inset: boolean) => [...layers].reverse().filter((s) => s.inset === inset)
        .map((s) => (s.color === 'currentColor' ? '#123456' : s.color));
      expect(under).toHaveLength(want(false).length);
      expect(over.map(colorOf)).toEqual(want(true));
      expect(numbers([under, over]).every(Number.isFinite)).toBe(true);
    }), runs(RUNS));
  });

  it('paints an inset layer of a square box on exactly the box less its offset, spread-shrunk inner box', () => {
    const seen = tally();
    fc.assert(fc.property(box, layer.map((s) => ({ ...s, inset: true })), fc.nat(), fc.nat(), (b, s, i, j) => {
      const [ring] = pathsOf(boxShadowCommands(b, 0, [s], 'black').over[0]);
      const px = b.x + (i % b.w) + 0.5, py = b.y + (j % b.h) + 0.5;
      const ix = b.x + s.x + s.spread, iy = b.y + s.y + s.spread, iw = b.w - 2 * s.spread, ih = b.h - 2 * s.spread;
      const inHole = iw > 0 && ih > 0 && px >= ix && px < ix + iw && py >= iy && py < iy + ih;
      expect(pointInPath(ring!, px, py)).toBe(!inHole);
      seen.hit(inHole ? 'clear' : 'shadowed');
    }), runs(RUNS * 3));
    seen.atLeast('clear', 50);
    seen.atLeast('shadowed', 50);
  });

  it('casts a hard outer layer of a square box as the box moved by its offset and grown by its spread, square too', () => {
    const seen = tally();
    fc.assert(fc.property(box, layer.map((s) => ({ ...s, inset: false, blur: 0 })), fc.integer({ min: -20, max: 60 }), fc.integer({ min: -20, max: 60 }),
      (b, s, i, j) => {
        const paths = pathsOf(boxShadowCommands(b, 0, [s], 'black').under[0]);
        const px = b.x + i + 0.5, py = b.y + j + 0.5;
        const ox = b.x + s.x - s.spread, oy = b.y + s.y - s.spread, ow = b.w + 2 * s.spread, oh = b.h + 2 * s.spread;
        const inShadow = ow > 0 && oh > 0 && px >= ox && px < ox + ow && py >= oy && py < oy + oh;
        expect(paths.some((p) => pointInPath(p, px, py))).toBe(inShadow);
        seen.hit(inShadow ? 'shadowed' : 'clear');
      }), runs(RUNS * 3));
    seen.atLeast('clear', 50);
    seen.atLeast('shadowed', 50);
  });
});
