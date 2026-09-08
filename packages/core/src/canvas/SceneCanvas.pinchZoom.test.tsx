/**
 * SceneCanvas — two-finger pinch zoom.
 *
 * Pinch is the `viewport.pinchZoom` action, driven by the gesture dispatcher's
 * multitouch stream. It is the only pinch path in the kit.
 *
 * These assert the emitted view, so the absent WebGL context is irrelevant.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { View } from 'core/viewport/view';

type D = { kind: 'rect' };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

type PinchConfig = boolean | { min?: number; max?: number };

/** Renders SceneCanvas uncontrolled and records every view it emits.
 *  `offset` places the canvas away from the viewport top-left. */
function mountAndPinch(
  pinchZoom: PinchConfig | undefined,
  offset: { left: number; top: number } = { left: 0, top: 0 },
): View[] {
  const emitted: View[] = [];
  const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  const { container } = render(
    <SceneCanvas
      scene={scene}
      layers={{}}
      width={400}
      height={400}
      viewport={pinchZoom === undefined ? {} : { pinchZoom }}
      onViewChange={(v) => { emitted.push(v); }}
    />,
  );
  const canvas = container.querySelector('canvas');
  if (!canvas) throw new Error('SceneCanvas rendered no canvas element');
  canvas.getBoundingClientRect = () => ({
    left: offset.left, top: offset.top, right: offset.left + 400, bottom: offset.top + 400,
    width: 400, height: 400, x: offset.left, y: offset.top, toJSON() { return {}; },
  }) as DOMRect;

  const fire = (type: string, pointerId: number, clientX: number, clientY: number) => {
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId, clientX, clientY }));
  };

  act(() => {
    fire('pointerdown', 1, 100, 100);
    fire('pointerdown', 2, 200, 100);
  });
  // Anything the mount itself emitted is not part of the gesture.
  emitted.length = 0;
  act(() => {
    // Spread 100 → 200: one clean factor of 2.
    fire('pointermove', 2, 300, 100);
  });
  return emitted;
}

describe('SceneCanvas pinch zoom', () => {
  it('applies the factor once with viewport.pinchZoom on', () => {
    const emitted = mountAndPinch(true);
    expect(emitted.map((v) => v.scale.x)).toEqual([2]);
  });

  it('applies the factor once with viewport.pinchZoom omitted', () => {
    const emitted = mountAndPinch(undefined);
    expect(emitted.map((v) => v.scale.x)).toEqual([2]);
  });

  it('clamps to the max from viewport.pinchZoom', () => {
    const emitted = mountAndPinch({ min: 0.5, max: 1.5 });
    expect(emitted.map((v) => v.scale.x)).toEqual([1.5]);
  });

  it('does not zoom when viewport.pinchZoom is false', () => {
    expect(mountAndPinch(false)).toEqual([]);
  });

  it('anchors on the fingers in canvas-local coords, not client coords', () => {
    // Fingers at client (100,100)/(200,100) → (100,100)/(300,100). On a canvas
    // offset by (40,30) the centroid travels (110,70) → (160,70) canvas-local.
    // zoomAt about (110,70) at factor 2 gives (55, 35); translating by the
    // centroid's 50px of travel lands x at 30.
    const emitted = mountAndPinch(true, { left: 40, top: 30 });
    expect(emitted).toEqual([{ x: 30, y: 35, scale: { x: 2, y: 2 } }]);
  });
});
