import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createEvent, act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { SceneCanvas, BUILTIN_TOOL_IDS } from './SceneCanvas';
import { useScene } from 'core/scene/useScene';
import type { Scene } from 'core/scene/types';
import { createSymmetryStore, symmetryContribution, type SymmetryStore } from 'features/symmetry';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

type P = { x: number; y: number; width: number; height: number };

function dragOn(canvas: HTMLCanvasElement, from: { x: number; y: number }, to: { x: number; y: number }) {
  const at = (ev: Event, p: { x: number; y: number }) => {
    Object.defineProperty(ev, 'clientX', { value: p.x });
    Object.defineProperty(ev, 'clientY', { value: p.y });
    return ev;
  };
  const init = { pointerId: 1, button: 0, isPrimary: true };
  act(() => {
    canvas.dispatchEvent(at(createEvent.pointerDown(canvas, init), from));
    canvas.dispatchEvent(at(createEvent.pointerMove(canvas, init), to));
    canvas.dispatchEvent(at(createEvent.pointerUp(canvas, init), to));
  });
}

function mount(store: SymmetryStore) {
  const entry = symmetryContribution(store);
  let scene!: Scene<unknown, string, unknown>;
  function Harness() {
    const s = useScene<{ color: string }, 'main', P>({ systemLayers: [{ id: 'main' }], initial: [] });
    scene = s as unknown as Scene<unknown, string, unknown>;
    return (
      <SceneCanvas
        features={['draw']}
        scene={s}
        width={200} height={200}
        layers={{}}
        defaultTools={BUILTIN_TOOL_IDS}
        initialActiveTool="rect"
        ambient={[entry]}
      />
    );
  }
  const { container } = render(<Harness />);
  return { canvas: container.querySelector('canvas') as HTMLCanvasElement, scene: () => scene };
}

const posesOf = (scene: Scene<unknown, string, unknown>) =>
  scene.renderOrderNodes().map((n) => n.pose as P).map(({ x, y, width, height }) => ({ x, y, width, height }));

describe('<SceneCanvas> with the symmetry entry', () => {
  it('draws a rectangle and its mirror as one undo step', () => {
    const { canvas, scene } = mount(createSymmetryStore({ axis: 'vertical', center: { x: 100, y: 100 } }));
    dragOn(canvas, { x: 20, y: 30 }, { x: 60, y: 70 });
    expect(posesOf(scene())).toEqual([
      { x: 20, y: 30, width: 40, height: 40 },
      { x: 140, y: 30, width: 40, height: 40 },
    ]);
    act(() => { scene().undo(); });
    expect(posesOf(scene())).toEqual([]);
  });

  it('drags the axis by its handle instead of drawing', () => {
    const store = createSymmetryStore({ axis: 'vertical', center: { x: 100, y: 100 } });
    const { canvas, scene } = mount(store);
    dragOn(canvas, { x: 100, y: 100 }, { x: 130, y: 120 });
    expect(store.get()?.center).toEqual({ x: 130, y: 100 });
    expect(posesOf(scene())).toEqual([]);
  });

  it('draws one rectangle while symmetry is off', () => {
    const { canvas, scene } = mount(createSymmetryStore());
    dragOn(canvas, { x: 20, y: 30 }, { x: 60, y: 70 });
    expect(posesOf(scene())).toHaveLength(1);
  });
});
