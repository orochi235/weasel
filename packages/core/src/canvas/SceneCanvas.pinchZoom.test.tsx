/**
 * SceneCanvas — two-finger pinch zoom.
 *
 * Under SceneCanvas the pinch is the `viewport.pinchZoom` action, driven by the
 * gesture dispatcher's multitouch stream. `<Canvas>`'s `usePinchZoomTool` DOM
 * listener is the bare-Canvas path and must not also run here, or the same
 * gesture applies its factor twice.
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

/** Renders SceneCanvas uncontrolled and records every view it emits. */
function mountAndPinch(pinchZoom: PinchConfig | undefined): View[] {
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
});
