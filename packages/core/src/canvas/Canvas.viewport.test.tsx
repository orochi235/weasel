/**
 * Canvas viewport prop coverage
 *
 * `<Canvas>` owns only the pinch-zoom DOM listener (via `usePinchZoomTool`).
 * The hand tool, wheel pan/zoom action descriptors, and keyboard zoom shortcuts
 * are SceneCanvas-level concerns — they belong with the tool registry and
 * gesture dispatcher, not with bare Canvas. SceneCanvas drives pinch through
 * the `viewport.pinchZoom` action instead and does not forward this prop, so
 * what these cover is the bare-Canvas path.
 *
 * Assertions are on the emitted view, so the absent 2D context doesn't matter.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { Canvas } from './Canvas';
import type { View } from 'core/viewport/view';

// ---------------------------------------------------------------------------
// jsdom canvas setup
// ---------------------------------------------------------------------------

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => ({
    canvas: { width: 0, height: 0 },
    clearRect: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
    save: vi.fn(), restore: vi.fn(), translate: vi.fn(), setTransform: vi.fn(),
    scale: vi.fn(), setLineDash: vi.fn(), beginPath: vi.fn(), closePath: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), arc: vi.fn(), stroke: vi.fn(), fill: vi.fn(),
    fillText: vi.fn(), measureText: vi.fn(() => ({ width: 10 })),
    font: '', textBaseline: '', globalAlpha: 1,
    fillStyle: '', strokeStyle: '', lineWidth: 1,
  } as unknown as CanvasRenderingContext2D));
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

type PinchConfig = boolean | { min?: number; max?: number };

/** Renders an uncontrolled Canvas, pinches two fingers apart by a factor of
 *  two, and returns every view emitted by the gesture. */
function mountAndPinch(pinchZoom: PinchConfig | undefined): View[] {
  const emitted: View[] = [];
  const { container } = render(
    <Canvas
      width={200}
      height={200}
      layers={{}}
      viewport={pinchZoom === undefined ? undefined : { pinchZoom }}
      onViewChange={(v) => { emitted.push(v); }}
    />,
  );
  const canvas = container.querySelector('canvas');
  if (!canvas) throw new Error('Canvas rendered no canvas element');

  const fire = (type: string, pointerId: number, clientX: number, clientY: number) => {
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId, clientX, clientY }));
  };

  act(() => {
    fire('pointerdown', 1, 100, 100);
    fire('pointerdown', 2, 200, 100);
  });
  emitted.length = 0;
  act(() => {
    // Spread 100 → 200.
    fire('pointermove', 2, 300, 100);
  });
  return emitted;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Canvas viewport prop: pinchZoom', () => {
  it('zooms by the spread ratio when enabled', () => {
    expect(mountAndPinch(true).map((v) => v.scale.x)).toEqual([2]);
  });

  it('clamps the zoom to the configured min/max', () => {
    expect(mountAndPinch({ min: 0.5, max: 1.5 }).map((v) => v.scale.x)).toEqual([1.5]);
  });

  it('does not listen when the viewport prop is omitted', () => {
    expect(mountAndPinch(undefined)).toEqual([]);
  });

  it('does not listen when pinchZoom is false', () => {
    expect(mountAndPinch(false)).toEqual([]);
  });
});
