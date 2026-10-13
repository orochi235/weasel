/**
 * The edit overlay under a pose that declares a `frame`: the node's rotation
 * and `transform`, about the box center. jsdom lays nothing out, so this
 * reads the transform the hook wrote; `overlayFrame.browser.test.tsx` in core
 * is what says the box lands on the drawn shape.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { TextStyle } from '@weasel-js/text';
import { useTextEdit } from './useTextEdit';
import type { TextEditScreenPose, UseTextEditOptions } from './textEditTypes';

const getOverlay = (c: HTMLElement) => c.querySelector<HTMLDivElement>('[contenteditable="true"]');

function open(pose: Partial<TextEditScreenPose>, style: TextStyle = { fontSize: 16, wrap: true }) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const opts: UseTextEditOptions = {
    container,
    getText: () => 'abc',
    getStyle: () => style,
    getScreenPose: () => ({ x: 10, y: 20, width: 200, height: 40, fontSize: 16, ...pose }),
    setText: () => {},
  };
  const { result } = renderHook(() => useTextEdit(opts));
  act(() => result.current.startEdit('a'));
  return getOverlay(container)!;
}

/** `matrix(a, b, c, d, e, f)` as numbers. */
function matrixOf(el: HTMLElement): number[] {
  const m = /^matrix\(([^)]+)\)/.exec(el.style.transform);
  if (!m) throw new Error(`no matrix in "${el.style.transform}"`);
  return m[1].split(',').map(Number);
}

/** Where the overlay's own point `(u, v)` lands, in container pixels. */
function land(el: HTMLElement, u: number, v: number): { x: number; y: number } {
  const [a, b, c, d, e, f] = matrixOf(el);
  return {
    x: parseFloat(el.style.left) + a * u + c * v + e,
    y: parseFloat(el.style.top) + b * u + d * v + f,
  };
}

describe('useTextEdit — framed overlay', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('writes no matrix for a pose with no frame', () => {
    expect(open({ zoom: 2 }).style.transform).toBe('scale(2)');
  });

  it('turns the box about its center, not its origin', () => {
    const quarter = [0, 1, -1, 0] as const;
    const el = open({ frame: quarter });
    // Box (10,20) 200×40, center (110,40): a quarter turn sends its top-left
    // to (130,-60) and its bottom-right to (90,140).
    expect(land(el, 0, 0).x).toBeCloseTo(130, 6);
    expect(land(el, 0, 0).y).toBeCloseTo(-60, 6);
    expect(land(el, 200, 40).x).toBeCloseTo(90, 6);
    expect(land(el, 200, 40).y).toBeCloseTo(140, 6);
  });

  it('skews the box about its center, under the view scale', () => {
    const el = open({ zoom: 2, frame: [1, 0, 0.5, 1] });
    // On screen the box is (10,20) 400×80, center (210,60). The skew moves a
    // point by half its height off the center: the top edge 20 left, the
    // bottom edge 20 right.
    expect(land(el, 0, 0)).toEqual({ x: -10, y: 20 });
    expect(land(el, 200, 0)).toEqual({ x: 390, y: 20 });
    expect(land(el, 200, 40)).toEqual({ x: 430, y: 100 });
    expect(el.style.transformOrigin).toBe('0 0');
  });

  it('keeps the unwrapped alignment shift inside the frame', () => {
    const el = open({ frame: [1, 0, 0.5, 1] }, { fontSize: 16, align: 'right' });
    expect(el.style.transform).toMatch(/^matrix\([^)]+\) translateX\(-100%\)$/);
    // The right edge of the box, where a right-aligned line ends.
    expect(el.style.left).toBe('210px');
    expect(land(el, 0, 0)).toEqual({ x: 200, y: 20 });
  });
});
