/** The shape builder through `<SceneCanvas>`: its hover, drag, and fallback bindings reach their actions. */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import type { Path } from '@weasel-js/geom';
import {
  createScene, SceneCanvas, useBooleansAdapter, useSelection,
  type BooleansAdapter, type NodeId, type RenderLayer, type SelectionApi,
} from '@weasel-js/core';
import { rootsTreeForTests as rootsTree } from '@weasel-js/core/test-seams';
import { useShapeBuilderTool } from './useShapeBuilderTool';

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

function mount() {
  const scene = createScene<{ kind: string }, 'main', P>({ systemLayers: [{ id: 'main' }] });
  const ids: NodeId[] = [];
  scene.batch('seed', () => {
    ids.push(scene.add({ kind: 'mark', data: { kind: 'rect' }, layer: 'main', pose: { x: 0, y: 0, width: 100, height: 100 } }));
    ids.push(scene.add({ kind: 'mark', data: { kind: 'rect' }, layer: 'main', pose: { x: 50, y: 0, width: 100, height: 100 } }));
  });
  const applyOps = vi.fn();
  const pathOf = (id: string): Path | undefined => {
    const pose = scene.get(id as NodeId)?.pose;
    return pose ? { kind: 'rect', ...pose } : undefined;
  };
  let selection: SelectionApi | null = null;
  let overlay: RenderLayer<unknown> | null = null;

  function Adapter() {
    const sel = useSelection({ scene, mode: 'multi' });
    selection = sel;
    const adapter: BooleansAdapter = {
      ...rootsTree(ids.slice()),
      getSelection: () => sel.get() as NodeId[],
      getWorldPath: pathOf,
      compareZ: (a, b) => ids.indexOf(a) - ids.indexOf(b),
      getNode: (id) => ({ id }),
      createPathNode: (path) => ({ id: `made-${JSON.stringify(path).length}` }),
      applyOps,
    };
    return { sel, adapter };
  }
  function Publish({ adapter }: { adapter: BooleansAdapter }) {
    useBooleansAdapter(adapter);
    return null;
  }
  function Harness() {
    const { sel, adapter } = Adapter();
    const shapeBuilder = useShapeBuilderTool();
    overlay = shapeBuilder.overlay as RenderLayer<unknown>;
    return (
      <SceneCanvas features={['draw']} scene={scene} selection={sel} layers={{}} width={400} height={400} tools={{ shapeBuilder }}>
        <Publish adapter={adapter} />
      </SceneCanvas>
    );
  }
  const { container } = render(<Harness />);
  const canvas = container.querySelector('canvas')!;
  act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'M', code: 'KeyM', shiftKey: true })); });
  const pointer = (type: string, x: number, y: number, init: PointerEventInit = {}) =>
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, ...init }));
  const shown = () => overlay!.draw(null, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 400, height: 400 }).length;
  return { ids, applyOps, pointer, shown, select: (next: NodeId[]) => act(() => { selection!.set(next); }) };
}

describe('useShapeBuilderTool — through <SceneCanvas>', () => {
  it('shows the face under a hovering pointer', () => {
    const s = mount();
    s.select(s.ids);
    act(() => { s.pointer('pointermove', 75, 50, { buttons: 0 }); });
    expect(s.shown()).toBe(1);
  });

  it('commits the faces a drag crosses as one batch', () => {
    const s = mount();
    s.select(s.ids);
    act(() => {
      s.pointer('pointerdown', 20, 50, { buttons: 1 });
      s.pointer('pointermove', 75, 50, { buttons: 1 });
      s.pointer('pointermove', 130, 50, { buttons: 1 });
      s.pointer('pointerup', 130, 50);
    });
    expect(s.applyOps).toHaveBeenCalledTimes(1);
    expect(s.applyOps.mock.calls[0]![1]).toBe('Shape Builder');
  });

  it('builds nothing from a drag with one path selected', () => {
    const s = mount();
    s.select([s.ids[0]!]);
    act(() => {
      s.pointer('pointerdown', 20, 50, { buttons: 1 });
      s.pointer('pointermove', 130, 50, { buttons: 1 });
      s.pointer('pointerup', 130, 50);
    });
    expect(s.applyOps).not.toHaveBeenCalled();
  });
});
