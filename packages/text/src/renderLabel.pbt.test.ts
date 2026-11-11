/** `renderLabel`'s pill holds its text: padded around the content, centered on the anchor or opening padX
 *  before it, with the context restored after. */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { renderLabel } from './renderLabel';
import { runs } from './pbt.fixture';

function recorder() {
  const calls: { op: string; args: number[] }[] = [];
  let depth = 0;
  const ctx = {
    font: '', textBaseline: 'alphabetic', textAlign: 'start', fillStyle: '',
    save: () => { depth++; },
    restore: () => { depth--; },
    measureText: (t: string) => ({ width: [...t].length * 7 }),
    beginPath: () => {},
    roundRect: (...args: number[]) => { calls.push({ op: 'rect', args }); },
    fill: () => {},
    fillText: (_t: string, ...args: number[]) => { calls.push({ op: 'text', args }); },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, depth: () => depth };
}

const num = fc.double({ min: -1e4, max: 1e4, noNaN: true });

describe('renderLabel, property', () => {
  it('pads the pill around its content and anchors it as aligned', () => {
    fc.assert(fc.property(fc.string({ maxLength: 12 }), num, num, fc.record({
      align: fc.constantFrom('center' as const, 'left' as const),
      fontSize: fc.integer({ min: 6, max: 40 }),
      width: fc.double({ min: 0, max: 300, noNaN: true }),
      height: fc.double({ min: 0, max: 60, noNaN: true }),
      padX: fc.integer({ min: 0, max: 12 }),
      padY: fc.integer({ min: 0, max: 8 }),
    }, { requiredKeys: [] }), (text, x, y, o) => {
      const r = recorder();
      renderLabel(r.ctx, text, x, y, o);
      expect(r.depth()).toBe(0);
      const rect = r.calls.find((c) => c.op === 'rect')!.args;
      const label = r.calls.find((c) => c.op === 'text')!.args;
      const padX = o.padX ?? 4;
      const padY = o.padY ?? 1;
      const contentW = o.width ?? [...text].length * 7;
      expect(rect[2]).toBeCloseTo(contentW + padX * 2, 9);
      expect(rect[3]).toBeCloseTo((o.height ?? o.fontSize ?? 13) + padY * 2, 9);
      expect(rect[1]).toBeCloseTo(y - padY, 9);
      if ((o.align ?? 'center') === 'center') expect(rect[0]! + rect[2]! / 2).toBeCloseTo(x, 6);
      else expect(rect[0]).toBeCloseTo(x - padX, 9);
      expect(label).toEqual([x, y]);
    }), runs(200));
  });
});
