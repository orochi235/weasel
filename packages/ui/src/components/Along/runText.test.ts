import { afterEach, expect, test, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { lineShape, trackRun } from '@weasel-js/geom';
import row from './runRow.module.css';
import { useRunText } from './runText';

interface Affine { a: number; b: number; c: number; d: number; e: number; f: number }
const apply = (m: Affine, x: number, y: number) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f });

const rangeRect = Object.getOwnPropertyDescriptor(Range.prototype, 'getBoundingClientRect');

afterEach(() => {
  if (rangeRect) Object.defineProperty(Range.prototype, 'getBoundingClientRect', rangeRect);
  else delete (Range.prototype as Partial<Range>).getBoundingClientRect;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

/** The path a label's copy is drawn along, for a 100 × 50 root drawn on screen through `toClient`. */
function bentPath(toClient: Affine, toRoot: Affine): string | null {
  const root = document.createElement('div');
  const band = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const item = document.createElement('span');
  item.className = row.item!;
  item.textContent = 'Label';
  root.append(band, item);
  document.body.append(root);
  Object.defineProperty(root, 'offsetWidth', { value: 100 });
  Object.defineProperty(root, 'offsetHeight', { value: 50 });
  (band as unknown as { getScreenCTM: () => unknown }).getScreenCTM = () => ({ inverse: () => toRoot });
  vi.stubGlobal('DOMPoint', class {
    constructor(private x: number, private y: number) {}
    matrixTransform(m: Affine) {
      return apply(m, this.x, this.y);
    }
  });
  const rectOf = (pts: { x: number; y: number }[]): DOMRect => {
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    return DOMRect.fromRect({ x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) });
  };
  const corners = (x: number, y: number, w: number, h: number) => [apply(toClient, x, y), apply(toClient, x + w, y), apply(toClient, x, y + h), apply(toClient, x + w, y + h)];
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return this.hasAttribute('data-run-text-bend') ? rectOf(corners(20, 20, 0, 0)) : rectOf(corners(0, 0, 100, 50));
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  Range.prototype.getBoundingClientRect = () => rectOf(corners(20, 20, 20, 10));
  renderHook(() => useRunText({ current: root }, trackRun(lineShape({ x: 0, y: 25 }, { x: 100, y: 25 })), { current: band }));
  return root.querySelector('[data-run-text-bend]')?.shadowRoot?.querySelector('path')?.getAttribute('d') ?? null;
}

test('a label under a rotated ancestor is drawn where it would be drawn unrotated', () => {
  const identity = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const flat = bentPath(identity, identity);
  expect(flat).not.toBeNull();
  // Turned a quarter clockwise on screen: client = (50 - y, x).
  const turned = bentPath({ a: 0, b: 1, c: -1, d: 0, e: 50, f: 0 }, { a: 0, b: -1, c: 1, d: 0, e: 0, f: 50 });
  expect(turned).toBe(flat);
});
