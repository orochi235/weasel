/**
 * Every tool path-tools ships, on a canvas with the `pathTools` feature: each has a complete definition whose
 * bindings name registered actions, its key makes it the active tool, and the reshaping tools commit through their
 * actions as one undo entry. The path-edit tools' commits are in `pathEditTools.canvas.test.tsx`, the shape
 * builder's in `useShapeBuilderTool.canvas.test.tsx`, and the warps' in `warp/`.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import {
  IDENTITY_POSE_COMPOSITION, SceneCanvas, asNodeId, createScene, pathFromD, toolGaps, toolIdsOf, useActionsRegistry, type ActionsRegistry, type PolygonPath,
  type ToolsApi,
} from '@weasel-js/core';
import { pathTools } from './presets';
import { PATH_EDIT_TOOLS, PATH_TOOLS_TOOLS, usePathToolsTools } from './toolSets';

const OURS = toolIdsOf([PATH_TOOLS_TOOLS]);

beforeAll(() => {
  (HTMLCanvasElement.prototype as unknown as { getContext: () => null }).getContext = () => null;
});
afterEach(() => cleanup());

type Data = { stroke?: unknown };

/** Strokes in world units: jsdom's canvas rect is all zeros and the view is identity. */
function mount(paths: Record<string, string>, selected: string[] = []) {
  // Each stroke is its own pose, as a drawn path is.
  const scene = createScene<Data, 'main', PolygonPath>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] });
  for (const [id, d] of Object.entries(paths)) {
    scene.add({
      id: asNodeId(id), kind: 'mark', layer: 'main', data: { stroke: { paint: { color: '#000' }, width: 2 } },
      pose: pathFromD(d) as PolygonPath,
    });
  }
  scene.setSelection(selected.map(asNodeId));
  const api: { tools?: ToolsApi; actions?: ActionsRegistry | null } = {};
  function Grab() {
    api.actions = useActionsRegistry();
    return null;
  }
  function Harness() {
    const tools = usePathToolsTools();
    return (
      <SceneCanvas features={['draw', pathTools]} scene={scene} layers={{}} width={400} height={400} tools={tools}
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
  const click = (p: [number, number]) => act(() => { at('pointerdown', p); at('pointerup', p); });
  const use = (id: string) => act(() => api.tools!.setActive(id));
  const d = (id: string) => scene.get(asNodeId(id))!.pose;
  return { scene, api, drag, click, use, d };
}

const press = (key: string, shiftKey: boolean) =>
  act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true })); });

describe('path-tools tools on a canvas', () => {
  it('each declare a complete tool whose bindings name registered actions', () => {
    const { api } = mount({});
    const ids = new Set(api.actions!.list().map((a) => a.id));
    // A path-edit tool's cursor is its action's, over the anchor or the stroke it would edit, as core's anchors tool's is.
    const edit = new Set<string>(toolIdsOf([PATH_EDIT_TOOLS]));
    for (const id of OURS) {
      const gaps = toolGaps(api.tools!.registry[id]!, (a) => ids.has(a)).filter((g) => !(edit.has(id) && g === 'no cursor'));
      expect(gaps, id).toEqual([]);
    }
  });

  it('each become the active tool on its own key', () => {
    const { api } = mount({});
    const keyed = OURS.map((id) => api.tools!.registry[id]!).filter((t) => t.keybinding);
    expect(keyed.length).toBeGreaterThan(0);
    for (const tool of keyed) {
      act(() => api.tools!.setActive('select'));
      const { key, shift } = tool.keybinding!;
      press(String(Array.isArray(key) ? key[0] : key), shift === true);
      expect(api.tools!.active, `${String(key)}${shift ? ' with Shift' : ''}`).toBe(tool.id);
    }
  });

  it('trim a stroke between two crossings with a click, as one undo entry', () => {
    const t = mount({ a: 'M 0 100 L 300 100', b: 'M 100 0 L 100 200', c: 'M 200 0 L 200 200' });
    t.use('trim');
    const before = t.scene.historyIndex();
    t.click([150, 100]);
    expect(t.scene.historyIndex()).toBe(before + 1);
    expect(t.d('a')).not.toEqual(pathFromD('M 0 100 L 300 100'));
  });

  it('extend an open end to the next stroke with a click, as one undo entry', () => {
    const t = mount({ a: 'M 0 100 L 100 100', wall: 'M 200 0 L 200 200' });
    t.use('extend');
    const before = t.scene.historyIndex();
    t.click([100, 100]);
    expect(t.scene.historyIndex()).toBe(before + 1);
    expect(t.d('a')).not.toEqual(pathFromD('M 0 100 L 100 100'));
  });

  it('smudge a selected outline with a drag, as one undo entry', () => {
    const t = mount({ a: 'M 0 100 L 100 100 L 200 100 L 300 100' }, ['a']);
    t.use('smudgeBrush');
    const before = t.scene.historyIndex();
    t.drag([[150, 100], [150, 120], [150, 140]]);
    expect(t.scene.historyIndex()).toBe(before + 1);
    expect(t.d('a')).not.toEqual(pathFromD('M 0 100 L 100 100 L 200 100 L 300 100'));
  });

  it('widen a stroke with a girth drag, as one undo entry', () => {
    const t = mount({ a: 'M 0 100 L 300 100' });
    t.use('girth');
    const before = t.scene.historyIndex();
    t.drag([[150, 100], [150, 110], [150, 120]]);
    expect(t.scene.historyIndex()).toBe(before + 1);
  });

  it('draw a spiro curve with clicks, closed on its first point, as one undo entry', () => {
    const t = mount({});
    t.use('spiro');
    const before = t.scene.historyIndex();
    for (const p of [[50, 50], [150, 50], [150, 150], [50, 50]] as [number, number][]) t.click(p);
    expect(t.scene.historyIndex()).toBe(before + 1);
    expect(t.scene.renderOrderNodes()).toHaveLength(1);
  });
});
