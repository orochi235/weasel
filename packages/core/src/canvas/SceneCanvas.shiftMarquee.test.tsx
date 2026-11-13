/** A Shift-drag on empty canvas marquees and adds what it takes to the selection. */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { NodeId } from 'core/scene/types';
import { useSelection, type SelectionApi } from 'core/selection/useSelection';

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

function drag(canvas: HTMLCanvasElement, from: { x: number; y: number }, to: { x: number; y: number }, shiftKey: boolean) {
  const at = (type: string, p: { x: number; y: number }) =>
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: p.x, clientY: p.y, pointerId: 1, shiftKey }));
  at('pointerdown', from);
  at('pointermove', { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 });
  at('pointermove', to);
  at('pointerup', to);
}

describe('marquee under the select tool', () => {
  function mount() {
    const scene = createScene<object, 'main', P>({ systemLayers: [{ id: 'main' }] });
    const a = scene.add({ kind: 'mark', data: {}, layer: 'main', pose: { x: 0, y: 0, width: 20, height: 20 } });
    const b = scene.add({ kind: 'mark', data: {}, layer: 'main', pose: { x: 100, y: 0, width: 20, height: 20 } });
    const held: { current: SelectionApi | null } = { current: null };
    function Host() {
      const selection = useSelection({ initial: [a] });
      held.current = selection;
      return <SceneCanvas features={['draw']} scene={scene} layers={{}} width={200} height={200} selection={selection} />;
    }
    const { container } = render(<Host />);
    return { canvas: container.querySelector('canvas')!, selection: { get: () => held.current!.get() }, a, b };
  }

  it('replaces the selection with what a plain drag takes', () => {
    const { canvas, selection, b } = mount();
    act(() => drag(canvas, { x: 90, y: 40 }, { x: 130, y: -10 }, false));
    expect(selection.get()).toEqual([b]);
  });

  it('adds what a Shift-drag takes to the selection', () => {
    const { canvas, selection, a, b } = mount();
    act(() => drag(canvas, { x: 90, y: 40 }, { x: 130, y: -10 }, true));
    expect([...selection.get()].sort()).toEqual([a, b].sort() as NodeId[]);
  });
});

describe('drawing a rect with a modifier held from the press', () => {
  function drawWith(mods: { shiftKey?: boolean; altKey?: boolean }) {
    const scene = createScene<object, 'main', P>({ systemLayers: [{ id: 'main' }] });
    const { container } = render(
      <SceneCanvas features={['draw']} scene={scene} layers={{}} width={200} height={200} defaultTools={["rect"]} defaultActiveTool="rect" />,
    );
    const canvas = container.querySelector('canvas')!;
    const at = (type: string, x: number, y: number) =>
      canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, ...mods }));
    act(() => { at('pointerdown', 50, 50); at('pointermove', 70, 60); at('pointermove', 90, 70); at('pointerup', 90, 70); });
    return [...scene.renderOrderNodes()];
  }
  it('draws one with nothing held', () => { expect(drawWith({})).toHaveLength(1); });
  it('draws one with Shift held', () => { expect(drawWith({ shiftKey: true })).toHaveLength(1); });
  it('draws one with Alt held', () => { expect(drawWith({ altKey: true })).toHaveLength(1); });
});
