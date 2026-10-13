/**
 * Canvas HUDs and the backgroundFill prop.
 *
 * Layer composition is read from the debug snapshot's layer list. Under
 * jsdom's GL stub the WebGL branch early-returns before `draw` fires, so this
 * proves at most that a layer was registered and ordered, never its pixels.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { Canvas } from './Canvas';
import type { CanvasDebugSink } from '../debug/types';
import { waitForFrame } from './testing/stubCanvasContext';

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

describe('<Canvas> backgroundFill prop', () => {
  it('includes a scene-background-fill layer before scene in the debug snapshot', async () => {
    const sinkRef: { current: CanvasDebugSink | null } =
      { current: null };

    render(
      <Canvas
        width={200}
        height={200}
        layers={{ scene: { drawOne: () => [] } }}
        backgroundFill={{ color: '#ff0000' }}
        debug={{ layers: true }}
        debugSinkRef={sinkRef}
      />,
    );
    await waitForFrame();

    const ids = sinkRef.current!.snapshot().layers.map((l) => l.id);
    expect(ids).toContain('scene');
    expect(ids).toContain('scene-background-fill');
    expect(ids.indexOf('scene-background-fill')).toBeLessThan(ids.indexOf('scene'));
  });

  it('omitting backgroundFill produces no scene-background-fill layer', async () => {
    const sinkRef: { current: CanvasDebugSink | null } =
      { current: null };

    render(
      <Canvas
        width={200}
        height={200}
        layers={{ scene: { drawOne: () => [] } }}
        debug={{ layers: true }}
        debugSinkRef={sinkRef}
      />,
    );
    await waitForFrame();

    const ids = sinkRef.current!.snapshot().layers.map((l) => l.id);
    expect(ids).toContain('scene');
    expect(ids).not.toContain('scene-background-fill');
  });
});

describe('<Canvas> HUDs', () => {
  // CursorCoordsHud returns null until its useEffect populates `anchor`, so
  // each render is wrapped in `act` to flush effects.

  it('renders CursorCoordsHud DOM element when cursorCoordsHud is true', async () => {
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(
        <Canvas
          width={200}
          height={200}
          layers={{}}
          cursorCoordsHud
        />,
      ));
    });
    // CursorCoordsHud renders a div containing fps text. The canvas itself
    // is a <canvas>, not a <div> — so any div inside container came from the HUD.
    expect(container.querySelectorAll('div').length).toBeGreaterThan(0);
  });

  it('renders PickHud DOM element when pickHud is true and pickEvery is provided', async () => {
    const pickEvery = vi.fn((_wx: number, _wy: number): string[] => ['shape-1']);
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(
        <Canvas
          width={200}
          height={200}
          layers={{}}
          pickHud
          pickEvery={pickEvery}
        />,
      ));
    });
    // PickHud renders a div with class s.hud containing a header div.
    expect(container.querySelectorAll('div').length).toBeGreaterThan(0);
  });

  it('both HUDs convert the pointer through the clientToWorld prop', async () => {
    const pickEvery = vi.fn((_wx: number, _wy: number): string[] => []);
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(
        <Canvas
          width={200}
          height={200}
          layers={{}}
          cursorCoordsHud
          pickHud
          pickEvery={pickEvery}
          clientToWorld={(_canvas, cx, cy) => [cx + 1000, cy + 2000]}
        />,
      ));
    });
    await act(async () => {
      const ev = new Event('pointermove', { bubbles: true });
      Object.defineProperties(ev, { clientX: { value: 0 }, clientY: { value: 0 } });
      document.dispatchEvent(ev);
    });
    expect(pickEvery).toHaveBeenCalledWith(1000, 2000);
    expect(container.textContent).toContain('(1000.0, 2000.0)');
  });

  it('does NOT render extra DOM nodes when HUD flags are absent', async () => {
    // Baseline: only the <canvas> element, no extra divs from HUDs.
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(
        <Canvas
          width={200}
          height={200}
          layers={{}}
        />,
      ));
    });
    // No HUD divs inside the Canvas subtree.
    expect(container.querySelectorAll('div').length).toBe(0);
  });
});
