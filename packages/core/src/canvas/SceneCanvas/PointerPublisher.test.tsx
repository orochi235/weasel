import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, fireEvent, createEvent } from '@testing-library/react';
import { useEffect } from 'react';
import { SceneCanvas } from '../SceneCanvas';
import { useScene } from 'core/scene/useScene';
import { usePointerContext, type PointerContextValue } from '@weasel-js/routing/react';

// jsdom doesn't implement getContext or pointer capture; stub minimally.
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

function pointerMoveAt(el: Element, clientX: number, clientY: number) {
  const move = createEvent.pointerMove(el, { pointerId: 1 });
  Object.defineProperty(move, 'clientX', { value: clientX });
  Object.defineProperty(move, 'clientY', { value: clientY });
  fireEvent(el, move);
}

let probedCtx: PointerContextValue | null = null;
function Probe() {
  const c = usePointerContext();
  useEffect(() => { probedCtx = c; });
  return null;
}
function Harness() {
  const scene = useScene<{ id: string }>({ items: [] });
  return (
    <SceneCanvas scene={scene} width={64} height={64} layers={{}}>
      <Probe />
    </SceneCanvas>
  );
}
function mount(): HTMLCanvasElement {
  probedCtx = null;
  const { container } = render(<Harness />);
  return container.querySelector('canvas')!;
}

describe('SceneCanvas — auto-wires PointerContext getDropPoint', () => {
  it("publishes the latest pointer position into the surrounding context after pointermove", () => {
    const canvas = mount();
    expect(probedCtx).not.toBeNull();
    // Before any pointer event: the ref is null (canvas not hovered).
    expect(probedCtx!.getDropPoint()).toBeNull();
    // jsdom's getBoundingClientRect returns zeros and default view is identity,
    // so clientX/Y maps 1:1 to world coords.
    pointerMoveAt(canvas, 42, 17);
    expect(probedCtx!.getDropPoint()).toEqual({ world: { x: 42, y: 17 }, viewId: null });
    // A second move updates the same ref.
    pointerMoveAt(canvas, 100, 200);
    expect(probedCtx!.getDropPoint()).toEqual({ world: { x: 100, y: 200 }, viewId: null });
    // pointerleave clears.
    fireEvent.pointerLeave(canvas);
    expect(probedCtx!.getDropPoint()).toBeNull();
  });

  it('keeps publishing off the canvas for a press that began on it', () => {
    const canvas = mount();
    fireEvent.pointerDown(canvas, { pointerId: 1, buttons: 1 });
    fireEvent.pointerLeave(canvas, { pointerId: 1, buttons: 1 });
    expect(probedCtx!.getDropPoint()).not.toBeNull();
    const move = createEvent.pointerMove(document.body, { pointerId: 1, buttons: 1 });
    Object.defineProperty(move, 'clientX', { value: 300 });
    Object.defineProperty(move, 'clientY', { value: 9 });
    fireEvent(document.body, move);
    expect(probedCtx!.getDropPoint()).toEqual({ world: { x: 300, y: 9 }, viewId: null });
  });

  it('reports nothing for a drag that began outside the canvas', () => {
    mount();
    fireEvent.pointerDown(document.body, { pointerId: 1, buttons: 1 });
    fireEvent.pointerMove(document.body, { pointerId: 1, buttons: 1, clientX: 300, clientY: 9 });
    expect(probedCtx!.getDropPoint()).toBeNull();
  });
});
