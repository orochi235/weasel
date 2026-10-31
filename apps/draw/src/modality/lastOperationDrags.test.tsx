/**
 * In draw, a drag that declares params leaves the last-operation panel up once it commits: Lengthen in path
 * edit, whose edits land in the mode's journal, and drawing a polygon. Changing a param there replays the drag
 * in place.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import {
  ActionsProvider, DepRegistryProvider, SceneCanvas, asNodeId, createScene, pathFromD, pathInWorld,
  useActionsRegistry, usePolygonTool, type PolygonPath, type ToolsApi,
} from '@weasel-js/core';
import { lengthenPreset, usePathEditTools } from '@weasel-js/path-tools';
import { useMemo } from 'react';
import { DEFAULT_MODES } from '@weasel-js/modes';
import { LastOperation } from '../ui/LastOperation';
import { createModeMachine } from './machine';
import { modePathEdit } from './pathEditHost';

beforeAll(() => {
  (HTMLCanvasElement.prototype as unknown as { getContext: () => null }).getContext = () => null;
});
afterEach(() => cleanup());

const A = asNodeId('a');
const FEATURES = ['draw', lengthenPreset] as const;
type Pose = { x: number; y: number; width: number; height: number };

function setup() {
  const scene = createScene<{ path: PolygonPath }, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
  const machine = createModeMachine({ modes: DEFAULT_MODES, history: scene.history });
  scene.setActiveJournalAccessor(() => machine.getActiveJournal());
  scene.add({
    id: A, kind: 'mark', layer: 'main',
    data: { path: pathFromD('M 0 0 C 30 0 0 20 30 20') as PolygonPath },
    pose: { x: 10, y: 10, width: 30, height: 20 },
  });
  scene.setSelection([A]);
  const grabbed: { trigger?: (id: string) => void; tools?: ToolsApi } = {};
  function Harness() {
    const actions = useActionsRegistry();
    grabbed.trigger = (id) => { actions?.trigger(id); };
    const pathEdit = useMemo(() => modePathEdit(machine, () => true), []);
    const pathTools = usePathEditTools();
    const polygon = usePolygonTool();
    const tools = useMemo(() => ({ ...pathTools, polygon }), [pathTools, polygon]);
    return (
      <>
        <SceneCanvas features={FEATURES} scene={scene} layers={{}} width={160} height={160}
          modes={machine.registry} pathEdit={pathEdit} tools={tools} onToolsCreated={(t) => { grabbed.tools = t; }} />
        <LastOperation />
      </>
    );
  }
  const { container } = render(<DepRegistryProvider><ActionsProvider><Harness /></ActionsProvider></DepRegistryProvider>);
  const canvas = container.querySelector('canvas')!;
  return {
    scene, canvas, machine,
    trigger: (id: string) => act(() => grabbed.trigger!(id)),
    use: (id: string) => act(() => grabbed.tools!.setActive(id)),
  };
}

// jsdom's canvas rect is all zeros and the view is identity, so client coords are world coords.
function drag(canvas: HTMLCanvasElement, from: [number, number], to: [number, number]) {
  const at = (type: string, [x, y]: [number, number]) =>
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
  act(() => {
    at('pointerdown', from);
    at('pointermove', [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]);
    at('pointermove', to);
    at('pointerup', to);
  });
}

const endOf = (scene: ReturnType<typeof setup>['scene']) => {
  const node = scene.get(A)!;
  const coords = (pathInWorld(node.data.path, node.pose as never) as PolygonPath).coords;
  return { x: coords.at(-2)!, y: coords.at(-1)! };
};

describe('drags in the last-operation panel', () => {
  it('shows Lengthen after a drag in path edit, and replays it with another shape in the journal', () => {
    const { scene, canvas, machine, trigger, use } = setup();
    trigger('enterPathEdit');
    use('lengthen');
    // The end anchor is at world (40, 30), heading +x, its handle far enough back that the press is the anchor's.
    drag(canvas, [40, 30], [70, 30]);
    const straight = endOf(scene);
    expect(straight.y).toBeCloseTo(30, 3);
    expect(screen.getByRole('region', { name: 'Lengthen path' })).toBeInTheDocument();
    act(() => { fireEvent.click(screen.getByRole('radio', { name: 'Arc' })); });
    expect(endOf(scene).y).not.toBeCloseTo(30, 1);
    expect(machine.getActiveJournal()!.entries().undo).toHaveLength(1);
    act(() => { machine.exitMode(); });
    expect(screen.queryByRole('region', { name: 'Lengthen path' })).toBeNull();
  });

  it('shows Polygon after drawing one, and redraws it with more sides', () => {
    const { scene, canvas, use } = setup();
    use('polygon');
    const before = new Set(scene.roots);
    const depth = scene.history.undoDepth();
    drag(canvas, [100, 100], [140, 140]);
    const made = () => scene.roots.filter((id) => !before.has(id));
    expect(made()).toHaveLength(1);
    expect(screen.getByRole('region', { name: 'Polygon' })).toBeInTheDocument();
    const sides = screen.getByRole('slider', { name: 'Sides' });
    act(() => { fireEvent.change(sides, { target: { value: '7' } }); });
    expect(made()).toHaveLength(1);
    expect((scene.get(made()[0]!)!.data as { generator?: { sides?: number } }).generator?.sides).toBe(7);
    expect(scene.history.undoDepth()).toBe(depth + 1);
  });
});
