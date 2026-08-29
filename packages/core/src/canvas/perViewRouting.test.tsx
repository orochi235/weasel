/**
 * Input and deps resolved for the view an event landed in, not for view zero:
 * the pointer coordinates a paste reads, the world rect a paste centers on,
 * and the dispatcher an Escape cancels.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, fireEvent, createEvent } from '@testing-library/react';
import { useEffect } from 'react';
import { SceneCanvas } from './SceneCanvas';
import { CanvasView } from './CanvasView';
import { createScene } from 'core/scene/scene';
import { usePointerContext, type PointerContextValue } from 'features/pointer/PointerContext';
import { useOptionalViewRegistry, type ViewRegistry } from './viewRegistry';
import type { View } from 'core/viewport/view';

type D = { kind: 'rect' };
type P = { x: number; y: number; width: number; height: number };

/** The panel occupies x ∈ [100, 200) of a 300×200 canvas at the client origin. */
const PANEL = { x: 100, y: 0, w: 100, h: 100 };
const PANEL_VIEW: View = { x: 1000, y: 2000, scale: { x: 2, y: 2 } };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

function mount() {
  const scene = createScene<D, 'main', P>({ systemLayers: [{ id: 'main' }] });
  let pointerCtx: PointerContextValue | null = null;
  let registry: ViewRegistry | null = null;
  function Probe() {
    const c = usePointerContext();
    const r = useOptionalViewRegistry();
    useEffect(() => { pointerCtx = c; registry = r; });
    return null;
  }
  const r = render(
    <SceneCanvas scene={scene} layers={{}} width={300} height={200}>
      <CanvasView id="panel" bounds={PANEL} defaultView={PANEL_VIEW} />
      <Probe />
    </SceneCanvas>,
  );
  return {
    canvas: r.container.querySelector('canvas')!,
    pointerCtx: (): PointerContextValue => pointerCtx!,
    panel: () => registry!.list().find((v) => v.id === 'panel')!,
  };
}

function pointerMoveAt(el: Element, clientX: number, clientY: number) {
  const move = createEvent.pointerMove(el, { pointerId: 1 });
  Object.defineProperty(move, 'clientX', { value: clientX });
  Object.defineProperty(move, 'clientY', { value: clientY });
  fireEvent(el, move);
}

describe('pointer world coordinates follow the view under the cursor', () => {
  it('reports panel-space coords inside the panel and canvas-space outside it', () => {
    const h = mount();
    // Outside the panel: the canvas's own identity camera.
    pointerMoveAt(h.canvas, 42, 17);
    expect(h.pointerCtx().getDropPoint()).toEqual({ worldX: 42, worldY: 17 });
    // Inside it: panel-local (50, 10) through a 2× camera at (1000, 2000).
    pointerMoveAt(h.canvas, 150, 10);
    expect(h.pointerCtx().getDropPoint()).toEqual({ worldX: 1025, worldY: 2005 });
  });
});

describe('a view answers the ingestion and dispatcher deps for itself', () => {
  it('centers a paste on its own camera', () => {
    const h = mount();
    const deps = h.panel().target.deps!();
    expect(deps.ingestion!.viewportWorldRect()).toEqual({
      x: 1000, y: 2000, width: PANEL.w / 2, height: PANEL.h / 2,
    });
  });

  it('cancels its own in-flight gesture, not the surface\'s', () => {
    const h = mount();
    const panel = h.panel();
    const spy = vi.spyOn(panel.target.dispatcher, 'cancelAll');
    panel.target.deps!().dispatcher!.cancelAll('cancel');
    expect(spy).toHaveBeenCalledWith('cancel');
  });
});
