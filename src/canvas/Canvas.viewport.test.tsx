/**
 * Canvas viewport prop coverage (Task 1.1)
 *
 * Verifies that `<Canvas>` owns the `viewport` prop and calls `useViewportTools`
 * internally. The hand tool and viewportRegistered flag are surfaced via the
 * `viewportToolsRef` callback so SceneCanvas can fold them into its own
 * `useTools` call.
 *
 * Three behavioral cases:
 *   1. `viewport={{ pan: true }}` — viewportToolsRef callback receives a
 *      handTool (object with onPointerDown etc.) and viewportRegistered=true.
 *   2. `viewport={{ pan: true, zoom: true }}` — same as above; zoom config
 *      does not prevent pan from mounting the hand tool.
 *   3. No viewport prop — viewportToolsRef callback receives viewportRegistered=false
 *      (bare Canvas has no pan/zoom enabled; default semantic is opt-in here,
 *      unlike SceneCanvas which defaults to enabled and must explicitly pass
 *      viewport={{ pan: true, zoom: true }} to Canvas to preserve that behavior).
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from './Canvas';
import type { UseViewportToolsReturn } from './SceneCanvas/useViewportTools';

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
// Behavior 1: viewport.pan enabled — viewportToolsRef gets handTool +
// viewportRegistered=true
// ---------------------------------------------------------------------------

describe('Canvas viewport prop: pan enabled', () => {
  it('calls viewportToolsRef with handTool and viewportRegistered=true when viewport.pan=true', () => {
    let result: UseViewportToolsReturn | null = null;
    const ref = { current: null as UseViewportToolsReturn | null };

    render(
      <Canvas
        width={200}
        height={200}
        layers={{}}
        viewport={{ pan: true }}
        viewportToolsRef={ref}
      />,
    );

    result = ref.current;
    expect(result).not.toBeNull();
    expect(result!.viewportRegistered).toBe(true);
    // handTool must be a tool object (has pointer handlers)
    expect(result!.handTool).toBeDefined();
    expect(typeof result!.handTool).toBe('object');
  });
});

// ---------------------------------------------------------------------------
// Behavior 2: viewport.pan + zoom both enabled
// ---------------------------------------------------------------------------

describe('Canvas viewport prop: pan and zoom enabled', () => {
  it('viewportRegistered=true and handTool present when both pan and zoom are enabled', () => {
    const ref = { current: null as UseViewportToolsReturn | null };

    render(
      <Canvas
        width={200}
        height={200}
        layers={{}}
        viewport={{ pan: true, zoom: true }}
        viewportToolsRef={ref}
      />,
    );

    expect(ref.current).not.toBeNull();
    expect(ref.current!.viewportRegistered).toBe(true);
    expect(ref.current!.handTool).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Behavior 3: no viewport prop — viewportRegistered=false (bare Canvas default
// is opt-in; SceneCanvas explicitly passes viewport to Canvas to preserve its
// own default-enabled behavior)
// ---------------------------------------------------------------------------

describe('Canvas viewport prop: absent (no viewport prop)', () => {
  it('viewportRegistered=false when viewport prop is omitted', () => {
    const ref = { current: null as UseViewportToolsReturn | null };

    render(
      <Canvas
        width={200}
        height={200}
        layers={{}}
        viewportToolsRef={ref}
      />,
    );

    expect(ref.current).not.toBeNull();
    expect(ref.current!.viewportRegistered).toBe(false);
  });
});
