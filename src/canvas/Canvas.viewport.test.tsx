/**
 * Canvas viewport prop coverage (Task 1.1 follow-up)
 *
 * After the Phase 1 cleanup, `<Canvas>` owns only the pinch-zoom DOM listener
 * (via `usePinchZoomTool`). The hand tool, wheel pan/zoom action descriptors,
 * and keyboard zoom shortcuts are SceneCanvas-level concerns — they belong with
 * the tool registry and gesture dispatcher, not with bare Canvas.
 *
 * The `viewportToolsRef` seam and the old `useViewportTools` delegation are
 * gone. There is nothing to assert about "handTool" or "viewportRegistered" on
 * `<Canvas>` — those concepts live in SceneCanvas.
 *
 * What we DO verify here:
 *   1. `viewport={{ pinchZoom: true }}` — Canvas mounts without error (the
 *      usePinchZoomTool hook runs, attaches nothing in jsdom but doesn't throw).
 *   2. No `viewport` prop — Canvas mounts without error; pinch-zoom listener
 *      is a no-op (enabled=false).
 *   3. `viewport={{ pinchZoom: { min: 0.5, max: 4 } }}` — Canvas mounts
 *      without error; pinch-zoom runs with constrained bounds.
 *
 * (All three are smoke tests; the deeper pinch-zoom behavior is exercised in
 * the usePinchZoomTool unit tests.)
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from './Canvas';

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
// Behavior 1: viewport.pinchZoom enabled
// ---------------------------------------------------------------------------

describe('Canvas viewport prop: pinchZoom enabled', () => {
  it('mounts without error when viewport.pinchZoom=true', () => {
    expect(() => {
      render(
        <Canvas
          width={200}
          height={200}
          layers={{}}
          viewport={{ pinchZoom: true }}
        />,
      );
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Behavior 2: no viewport prop
// ---------------------------------------------------------------------------

describe('Canvas viewport prop: absent (no viewport prop)', () => {
  it('mounts without error when viewport prop is omitted', () => {
    expect(() => {
      render(
        <Canvas
          width={200}
          height={200}
          layers={{}}
        />,
      );
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Behavior 3: pinchZoom with explicit min/max bounds
// ---------------------------------------------------------------------------

describe('Canvas viewport prop: pinchZoom with min/max config', () => {
  it('mounts without error with constrained pinch bounds', () => {
    expect(() => {
      render(
        <Canvas
          width={200}
          height={200}
          layers={{}}
          viewport={{ pinchZoom: { min: 0.5, max: 4 } }}
        />,
      );
    }).not.toThrow();
  });
});
