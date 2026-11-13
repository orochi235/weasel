/**
 * Every tool diagram ships, on a canvas: each is in a set and has a complete definition, and the stencil and
 * connector tools commit through their actions as one undo entry. The sequence tools' commits are covered by
 * `DiagramView.sequenceTools.test.tsx`.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import {
  SceneCanvas, createScene, toolGaps, toolIdsOf, useActionsRegistry, type ActionsRegistry, type RectPose, type ToolsApi,
} from '@weasel-js/core';
import { withDiagramRegistry } from './edge';
import { diagramEdgeOf } from './edgeTrait';
import { DIAGRAM_TOOLS, STENCIL_TOOLS, useDiagramTools } from './diagramTools';
import { STENCIL_GROUPS } from './diagramTypes/catalog';
import { sceneParticipants } from './portLayer';
import { FLOWCHART_STENCILS, stencilKind } from './stencil';
import { useStencilInsert } from './stencilTool';
import { CONNECTOR_TOOL_ID } from './connectorTool';

beforeAll(() => {
  (HTMLCanvasElement.prototype as unknown as { getContext: () => null }).getContext = () => null;
});
afterEach(() => cleanup());

const box = (id: string, x: number) => ({
  id, kind: 'mark' as const, layer: 'main', data: { diagram: {} }, pose: { x, y: 0, width: 100, height: 40 },
});

function mount() {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry: withDiagramRegistry() });
  scene.add(box('a', 0) as never);
  scene.add(box('b', 300) as never);
  const participants = sceneParticipants<RectPose>(scene as never);
  const api: { tools?: ToolsApi; actions?: ActionsRegistry | null } = {};
  function Insert() {
    useStencilInsert(FLOWCHART_STENCILS);
    api.actions = useActionsRegistry();
    return null;
  }
  let built: Record<string, unknown> = {};
  const connector = { participants };
  function Harness() {
    const tools = useDiagramTools<RectPose>({ connector, stencils: FLOWCHART_STENCILS });
    built = tools;
    return (
      <SceneCanvas scene={scene} layers={{}} width={600} height={400} tools={tools} onToolsCreated={(t) => { api.tools = t; }}>
        <Insert />
      </SceneCanvas>
    );
  }
  const { container } = render(<Harness />);
  const canvas = container.querySelector('canvas')!;
  const at = (type: string, x: number, y: number) =>
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, buttons: 1 }));
  const drag = (from: [number, number], to: [number, number]) => act(() => {
    at('pointerdown', ...from);
    at('pointermove', (from[0] + to[0]) / 2, (from[1] + to[1]) / 2);
    at('pointermove', ...to);
    at('pointerup', ...to);
  });
  return { scene, api, built: () => built, drag };
}

describe('diagram tools', () => {
  it('are each in DIAGRAM_TOOLS, one set per stencil group', () => {
    const { built } = mount();
    const named = new Set<string>(toolIdsOf([DIAGRAM_TOOLS]));
    for (const id of Object.keys(built())) expect(named.has(id), id).toBe(true);
    expect(STENCIL_TOOLS.members.map((m) => (typeof m === 'string' ? m : m.id))).toEqual(Object.keys(STENCIL_GROUPS));
  });

  it('each declare a complete tool whose bindings name registered actions', () => {
    const { api } = mount();
    const ids = new Set(api.actions!.list().map((a) => a.id));
    for (const tool of Object.values(api.tools!.registry)) {
      if (tool.id === 'select') continue;
      expect(toolGaps(tool, (id) => ids.has(id)), tool.id).toEqual([]);
    }
  });

  it('draw a stencil body by dragging, as one undo entry', () => {
    const { scene, api, drag } = mount();
    act(() => api.tools!.setActive(stencilKind('process')));
    const before = scene.historyIndex();
    drag([100, 200], [220, 280]);
    expect(scene.historyIndex()).toBe(before + 1);
    expect(scene.historyEntries().at(-1)?.label).toBe('Insert Process');
  });

  it('join two shapes with the connector, as one undo entry', () => {
    const { scene, api, drag } = mount();
    act(() => api.tools!.setActive(CONNECTOR_TOOL_ID));
    const before = scene.historyIndex();
    drag([50, 20], [350, 20]);
    expect(scene.historyIndex()).toBe(before + 1);
    const edges = scene.renderOrderNodes().filter((n) => diagramEdgeOf(n) !== null);
    expect(edges).toHaveLength(1);
  });
});
