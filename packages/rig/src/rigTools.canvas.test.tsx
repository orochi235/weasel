/**
 * The rig tools on a canvas: each has a complete definition whose bindings name registered actions, its key makes it
 * the active tool, and a drag commits through its action as one undo entry.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import type { Skeleton } from '@weasel-js/animator';
import { polygonFromPoints } from '@weasel-js/geom';
import {
  SceneCanvas, createScene, toolGaps, toolIdsOf, useActionsRegistry, type ActionsRegistry, type RectPose, type ToolsApi,
} from '@weasel-js/core';
import { RIG_TOOLS } from './toolSets';
import { useRigTools } from './useRigTools';

beforeAll(() => {
  (HTMLCanvasElement.prototype as unknown as { getContext: () => null }).getContext = () => null;
});
afterEach(() => cleanup());

type Data = { skeleton?: Skeleton; skin?: unknown; path?: unknown };
const ARM: Skeleton = { joints: [{ name: 'root', parent: null, bind: { x: 150, y: 150, rotation: 0, scaleX: 1, scaleY: 1 } }] };

function mount() {
  const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const box = { x: 100, y: 100, width: 200, height: 100 };
  const rig = scene.add({ kind: 'group', layer: 'main', pose: box, data: { skeleton: ARM } });
  const sleeve = scene.add({
    kind: 'mark', layer: 'main', parent: rig, pose: { x: 110, y: 120, width: 180, height: 20 },
    data: { path: polygonFromPoints([{ x: 110, y: 120 }, { x: 190, y: 120 }, { x: 290, y: 120 }, { x: 200, y: 140 }]) },
  });
  scene.setSelection([rig]);
  const api: { tools?: ToolsApi; actions?: ActionsRegistry | null } = {};
  function Grab() {
    api.actions = useActionsRegistry();
    return null;
  }
  function Harness() {
    const tools = useRigTools({ scene: scene as never });
    return (
      <SceneCanvas features={['draw']} scene={scene} layers={{}} width={400} height={400} tools={tools}
        onToolsCreated={(t) => { api.tools = t; }}>
        <Grab />
      </SceneCanvas>
    );
  }
  const { container } = render(<Harness />);
  const canvas = container.querySelector('canvas')!;
  const at = (type: string, [x, y]: [number, number]) =>
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, buttons: 1 }));
  const drag = (points: [number, number][]) => act(() => {
    at('pointerdown', points[0]!);
    for (const p of points.slice(1)) at('pointermove', p);
    at('pointerup', points[points.length - 1]!);
  });
  return { scene, rig, sleeve, api, drag };
}

describe('rig tools on a canvas', () => {
  it('each declare a complete tool whose bindings name registered actions', () => {
    const { api } = mount();
    const ids = new Set(api.actions!.list().map((a) => a.id));
    for (const id of toolIdsOf([RIG_TOOLS])) expect(toolGaps(api.tools!.registry[id]!, (a) => ids.has(a)), id).toEqual([]);
  });

  it('each become the active tool on its own key', () => {
    const { api } = mount();
    for (const [key, id] of [['J', 'bone'], ['W', 'weight']] as const) {
      act(() => api.tools!.setActive('select'));
      act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); });
      expect(api.tools!.active, key).toBe(id);
    }
  });

  it('draw a bone with the bone tool, as one undo entry', () => {
    const { scene, rig, api, drag } = mount();
    act(() => api.tools!.setActive('bone'));
    const before = scene.historyIndex();
    drag([[220, 150], [240, 150], [260, 150]]);
    expect(scene.historyIndex()).toBe(before + 1);
    expect(scene.get(rig)!.data.skeleton!.joints.length).toBeGreaterThan(1);
  });

  it('paint weights with the weight tool, as one undo entry', () => {
    const { scene, sleeve, api, drag } = mount();
    act(() => api.tools!.setActive('bone'));
    drag([[220, 150], [240, 150], [260, 150]]);
    act(() => api.tools!.setActive('weight'));
    const before = scene.historyIndex();
    drag([[150, 120], [190, 120], [230, 120]]);
    expect(scene.historyIndex()).toBe(before + 1);
    expect(scene.get(sleeve)!.data.skin).toBeDefined();
  });
});
