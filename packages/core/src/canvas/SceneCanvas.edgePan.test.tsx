/**
 * Edge panning on a real `<SceneCanvas>`: a move held at the canvas's edge
 * scrolls the view and carries the node with it, and `limit` stops both.
 * jsdom lays nothing out, so the canvas is given a rect by hand.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { NodeId } from 'core/scene/types';
import { useSelection } from 'core/selection/useSelection';
import type { SceneCanvasApi } from './canvasExtension';
import type { SceneCanvasViewport } from './SceneCanvas/viewportProp';

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

const frames = async (n: number) => {
  for (let i = 0; i < n; i++) await act(() => new Promise<void>((r) => requestAnimationFrame(() => r())));
};

/** A 200×200 canvas over one selected 50×50 rect at the origin. */
function mount(viewport: SceneCanvasViewport) {
  const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  const id = scene.add({ kind: 'mark', data: { kind: 'rect' }, layer: 'main', pose: { x: 0, y: 0, width: 50, height: 50 } }) as NodeId;
  const apiRef = { current: null as SceneCanvasApi | null };
  function Mount(): ReactNode {
    const selection = useSelection({ mode: 'multi', initial: [id] });
    return <SceneCanvas ref={apiRef} features={['draw']} scene={scene} width={200} height={200} selection={selection} viewport={viewport} />;
  }
  const { container } = render(<Mount />);
  const canvas = container.querySelector('canvas')!;
  canvas.getBoundingClientRect = () => new DOMRect(0, 0, 200, 200);
  const fire = (type: string, x: number, y: number): void => {
    act(() => { canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 })); });
  };
  return { fire, x: () => (scene.get(id)!.pose as P).x, view: () => apiRef.current!.getView() };
}

describe('SceneCanvas edge panning', () => {
  it('scrolls the view while a move is held at the edge, and the node goes with it', async () => {
    const { fire, x, view } = mount({ edgePan: { zone: 20, speed: 1000 } });
    fire('pointerdown', 25, 25);
    fire('pointermove', 100, 25);
    fire('pointermove', 195, 25);
    await frames(6);
    const scrolled = view().x;
    expect(scrolled).toBeGreaterThan(0);
    fire('pointerup', 195, 25);
    expect(x()).toBeCloseTo(170 + scrolled);
  });

  it('holds still away from the edge', async () => {
    const { fire, view } = mount({ edgePan: { zone: 20 } });
    fire('pointerdown', 25, 25);
    fire('pointermove', 100, 100);
    await frames(4);
    expect(view().x).toBe(0);
    fire('pointerup', 100, 100);
  });

  it('stops the drag and the scroll at the limit', async () => {
    const { fire, x, view } = mount({ edgePan: { zone: 20, limit: { past: 30 } } });
    fire('pointerdown', 25, 25);
    fire('pointermove', 100, 25);
    fire('pointermove', 195, 25);
    await frames(6);
    expect(view().x).toBe(0);
    fire('pointerup', 195, 25);
    // The content spanned 0..50, so the pointer is held at x = 80: 55 past where it was pressed.
    expect(x()).toBeCloseTo(55);
  });

  it('does nothing with edgePan off', async () => {
    const { fire, x, view } = mount({ edgePan: false });
    fire('pointerdown', 25, 25);
    fire('pointermove', 195, 25);
    await frames(4);
    fire('pointerup', 195, 25);
    expect(view().x).toBe(0);
    expect(x()).toBeCloseTo(170);
  });
});
