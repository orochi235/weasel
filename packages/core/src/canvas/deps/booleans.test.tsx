/** `<SceneCanvas>`'s own `booleansAdapter`: a Pathfinder action over a scene's path leaves, with nothing published by the consumer. */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { boundsOfPath, type Path } from '@weasel-js/geom';
import { SceneCanvas } from 'canvas/SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { NodeId } from 'core/scene/types';
import { useSelection, type SelectionApi } from 'core/selection/useSelection';
import { defineTool } from 'tools/overlayBinding';

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

/** A tool whose click runs `pathfinder.union`, which reads the `booleansAdapter` dep. */
const unionOnClick = defineTool({
  id: 'unionOnClick',
  capabilities: ['creates-shapes'],
  keybinding: { key: 'U', shift: true },
  bindings: [{ spec: { kind: 'click' }, actionId: 'pathfinder.union' }],
});

function mount() {
  const scene = createScene<D, 'main', P>({ systemLayers: [{ id: 'main' }], initial: [box(0, 'red'), box(50, 'blue')] });
  const ids = [...scene.renderOrder()];
  let selection: SelectionApi | null = null;
  function Harness() {
    const sel = useSelection({ scene, mode: 'multi' });
    selection = sel;
    return <SceneCanvas features={['draw']} scene={scene} selection={sel} layers={{}} width={400} height={400} tools={{ unionOnClick }} />;
  }
  const { container } = render(<Harness />);
  const canvas = container.querySelector('canvas')!;
  act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'U', code: 'KeyU', shiftKey: true })); });
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

describe('the canvas booleansAdapter', () => {
  it('unites the selected path leaves into a leaf standing in for the topmost, as one undo step', () => {
    const s = mount();
    act(() => {
      s.at('pointerdown', 75, 50, { buttons: 1 });
      s.at('pointerup', 75, 50);
    });
    const after = s.leaves();
    expect(after.map((l) => [l.color, l.pose])).toEqual([['blue', { x: 0, y: 0, width: 150, height: 100 }]]);
    expect(after.some((l) => s.ids.includes(l.id))).toBe(false);
    act(() => { s.scene.undo(); });
    expect(s.leaves().map((l) => l.id)).toEqual(s.ids);
  });
});
