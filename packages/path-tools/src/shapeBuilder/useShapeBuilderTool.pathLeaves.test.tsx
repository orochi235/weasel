/** The shape builder over a scene's path leaves, through `<SceneCanvas>`'s own `booleansAdapter`, with nothing published by the consumer. */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { boundsOfPath, type Path } from '@weasel-js/geom';
import { createScene, SceneCanvas, useSelection, type NodeId, type SelectionApi } from '@weasel-js/core';
import { useShapeBuilderTool } from './useShapeBuilderTool';

type P = { x: number; y: number; width: number; height: number };
type D = { path: Path; fill: { paint: { color: string } } };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto['getContext'] = vi.fn(() => null);
  proto['setPointerCapture'] = vi.fn();
  proto['releasePointerCapture'] = vi.fn();
});

const box = (x: number, color: string) => ({
  kind: 'mark' as const,
  layer: 'main' as const,
  pose: { x, y: 0, width: 100, height: 100 },
  data: { path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 } as Path, fill: { paint: { color } } },
});

function mount() {
  const scene = createScene<D, 'main', P>({ systemLayers: [{ id: 'main' }], initial: [box(0, 'red'), box(50, 'blue')] });
  const ids = [...scene.renderOrder()];
  let selection: SelectionApi | null = null;
  function Harness() {
    const sel = useSelection({ scene, mode: 'multi' });
    selection = sel;
    const shapeBuilder = useShapeBuilderTool();
    return <SceneCanvas features={['draw']} scene={scene} selection={sel} layers={{}} width={400} height={400} tools={{ shapeBuilder }} />;
  }
  const { container } = render(<Harness />);
  const canvas = container.querySelector('canvas')!;
  act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'M', code: 'KeyM', shiftKey: true })); });
  act(() => { selection!.set(ids); });
  const at = (type: string, x: number, y: number, init: PointerEventInit = {}) =>
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, ...init }));
  const leaves = () => [...scene.renderOrder()].map((id) => {
    const node = scene.get(id as NodeId)!;
    const b = boundsOfPath(node.data.path);
    return { id, pose: node.pose, color: node.data.fill.paint.color, path: [b.x, b.width] };
  });
  return { scene, ids, at, leaves };
}

describe('useShapeBuilderTool — over the canvas booleansAdapter', () => {
  it('unites the faces a drag crosses into a leaf wearing the first face’s source, as one undo step', () => {
    const s = mount();
    act(() => {
      s.at('pointerdown', 20, 50, { buttons: 1 });
      s.at('pointermove', 75, 50, { buttons: 1 });
      s.at('pointerup', 75, 50);
    });
    const after = s.leaves();
    expect(after.map((l) => [l.color, l.pose])).toEqual([
      ['red', { x: 0, y: 0, width: 100, height: 100 }],
      ['blue', { x: 100, y: 0, width: 50, height: 100 }],
    ]);
    expect(after.some((l) => s.ids.includes(l.id))).toBe(false);
    act(() => { s.scene.undo(); });
    expect(s.leaves().map((l) => l.id)).toEqual(s.ids);
  });
});
