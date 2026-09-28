import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import { PointerContextProvider, createPointerStore } from 'features/pointer/PointerContext';
import type { BoundGesture } from '@weasel-js/routing';

type P = { x: number; y: number; width: number; height: number };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn(() => null);
});

const keys: BoundGesture[] = [
  { spec: { kind: 'key', key: ['l', 'L'] }, opts: { params: { to: 'union' } } },
  { spec: { kind: 'key', key: ['l', 'L'], mods: { shift: true } }, opts: { params: { to: 'pointer' } } },
];

function setup() {
  const scene = createScene<unknown, 'main', P>({ systemLayers: [{ id: 'main' }] });
  scene.batch('seed', () => {
    scene.add({ id: asNodeId('a'), kind: 'leaf', data: {}, layer: 'main', pose: { x: 10, y: 0, width: 10, height: 10 } });
    scene.add({ id: asNodeId('b'), kind: 'leaf', data: {}, layer: 'main', pose: { x: 40, y: 0, width: 10, height: 10 } });
  });
  const pointer = createPointerStore();
  render(
    <PointerContextProvider store={pointer}>
      <SceneCanvas
        features={['arrange']} scene={scene} layers={{}} width={64} height={64}
        selectionOptions={{ mode: 'multi', initial: [asNodeId('a'), asNodeId('b')] }}
        actions={{ 'align.left': { defaultBinding: keys } }}
      />
    </PointerContextProvider>,
  );
  const xs = () => ['a', 'b'].map((id) => (scene.get(asNodeId(id))!.pose as P).x);
  return { pointer, xs };
}

describe('align bound with a reference', () => {
  it('a plain key aligns to the union; with Shift, to the pointer', () => {
    const { pointer, xs } = setup();
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', bubbles: true })); });
    expect(xs()).toEqual([10, 10]);

    act(() => { pointer.set({ worldX: 30, worldY: 5, viewId: null }); });
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'L', shiftKey: true, bubbles: true })); });
    expect(xs()).toEqual([30, 30]);
  });
});
