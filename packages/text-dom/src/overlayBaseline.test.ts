import { afterEach, expect, it, vi } from 'vitest';
import { resolveTextStyle } from '@weasel-js/text';
import { baselineDrop } from './overlayBaseline';

vi.mock('@weasel-js/text', async (load) => ({
  ...(await load<typeof import('@weasel-js/text')>()),
  layoutTextPose: () => ({ laid: { lines: [{ baselineY: 18 }] } }),
}));

const LINE = 20;
const BASELINE = 15;

/** Lay the probe out as a browser would, its baseline BASELINE down the line, and report each
 *  point through `m`, the transform on its ancestors. */
function stubLayout(m: (x: number, y: number) => [number, number]): void {
  const point = (x: number, y: number): DOMRect => {
    const [sx, sy] = m(x, y);
    return new DOMRect(sx, sy, 0, 0);
  };
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.style.display === 'inline-block') return point(0, BASELINE);
    if (this.style.position === 'absolute') return point(parseFloat(this.style.left) || 0, parseFloat(this.style.top) || 0);
    return new DOMRect();
  });
}

function drop(textRendering: string): number {
  const parent = document.createElement('div');
  const el = document.createElement('div');
  parent.appendChild(el);
  Object.assign(el.style, { fontFamily: 'serif', fontSize: '16px', lineHeight: `${LINE}px`, textRendering });
  const style = resolveTextStyle({ fontSize: 16 });
  return baselineDrop(el, style, { x: 0, y: 0, width: 200, height: 40, fontSize: 16 }, LINE / 16);
}

afterEach(() => { vi.restoreAllMocks(); });

it('reads the CSS baseline under a turned ancestor', () => {
  const turn = Math.PI / 6;
  const [c, s] = [Math.cos(turn) * 2, Math.sin(turn) * 2];
  stubLayout((x, y) => [10 + c * x - s * y, 20 + s * x + c * y]);
  expect(drop('optimizeLegibility')).toBeCloseTo(18 - BASELINE, 6);
});

it('reads it under a skew', () => {
  stubLayout((x, y) => [x + 0.5 * y, y]);
  expect(drop('optimizeSpeed')).toBeCloseTo(18 - BASELINE, 6);
});
