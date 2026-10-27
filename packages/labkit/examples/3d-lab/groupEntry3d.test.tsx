/**
 * Entering the lab's container through core's dispatcher and select tool: a
 * click on a stacked solid selects the stack, a double-click enters it, and a
 * press outside its box leaves it. jsdom measures nothing, so the
 * viewport size is supplied and the pane sits at the origin.
 */

import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActionsProvider,
  ActiveToolContextProvider,
  DepRegistryProvider,
  useActionsRegistry,
  useActiveToolContext,
  useDepSource,
  useGestureDispatcher,
  useSelectTool,
  type NodeId,
  type Tool,
} from '@weasel-js/core';
import { createCamera, createNodeAtPoint, screenBoxOf, type Viewport3d } from '@weasel-js/kernel3d';
import { STACK, aabbOfSolid, createSolidScene, type SolidNode } from './scene3d';
import { useGroupEntry3d, type GroupEntry3d } from './groupEntry3d';

const VIEWPORT: Viewport3d = {
  camera: createCamera({ distance: 14, pitch: 0.45, yaw: 0.6, target: { x: 0, y: 0.5, z: 0 } }),
  width: 800,
  height: 600,
};

function mount() {
  const scene = createSolidScene();
  const out: { entry: GroupEntry3d | null; selection: readonly NodeId[] } = { entry: null, selection: [] };
  const world = {
    scene,
    viewport: () => VIEWPORT,
    bounds: (node: SolidNode) => (node.kind === 'group' ? null : aabbOfSolid(node.pose, node.data.kind)),
  };

  function App() {
    const paneRef = useRef<HTMLDivElement | null>(null);
    const actions = useActionsRegistry();
    const activeTool = useActiveToolContext();
    const [selection, setSelection] = useState<readonly NodeId[]>([]);
    const selectionRef = useRef(selection);
    selectionRef.current = selection;
    out.selection = selection;
    useDepSource('activeTool', () => activeTool);
    useDepSource('selection', () => ({
      get current() { return selectionRef.current; },
      get: () => [...selectionRef.current],
      set: (ids: NodeId[]) => setSelection(ids),
      clear: () => setSelection([]),
      applyClick: (id: NodeId) => setSelection([id]),
      contains: (id: NodeId) => selectionRef.current.includes(id),
    }) as never);

    const viewport = useCallback(() => VIEWPORT, []);
    const worldPick = useMemo(() => createNodeAtPoint(world), []);
    const entry = useGroupEntry3d(world, viewport, worldPick, () => {});
    out.entry = entry;
    useDepSource('nodeAtPoint', () => entry.pick);

    const select = useSelectTool({
      getNode: (id: string) => scene.get(id as NodeId),
      getNodes: () => [...scene.renderOrderNodes()],
      getPose: (id: string) => scene.get(id as NodeId)!.pose,
      setPose: () => {},
      getParent: (id: string) => scene.get(id as NodeId)?.parent ?? null,
      getChildren: (id: string | null) => (id === null ? [...scene.roots] : [...scene.childrenOf(id as NodeId)]),
      hitTestArea: () => [],
      getSelection: () => [...selectionRef.current],
      setSelection: (ids: string[]) => setSelection(ids as NodeId[]),
    } as never, { pickEvery: (p) => { const id = entry.pick(p); return id ? [id] : []; }, pickBest: (p) => entry.pick(p) });
    const entriesById = useMemo(() => new Map<string, Tool>([
      ['select', select as Tool],
      [entry.contribution.id, entry.contribution],
    ]), [select, entry.contribution]);

    useMemo(() => {
      if (!actions) return;
      for (const tool of entriesById.values()) for (const action of tool.actions ?? []) actions.register(action);
    }, [actions, entriesById]);

    const classifyTarget = useCallback((point: { x: number; y: number }) => {
      const id = entry.pick(point);
      if (!id) return { body: 'empty' as const };
      return { body: (selectionRef.current.includes(id) ? 'selected-body' : 'unselected-body') as 'selected-body' | 'unselected-body' };
    }, [entry]);

    useGestureDispatcher({
      canvasRef: paneRef,
      actions: actions!,
      entriesById,
      clientToWorld: (x, y) => ({ x, y }),
      classifyTarget,
    });
    return <div data-testid="pane" ref={paneRef} />;
  }

  const { getByTestId } = render(
    <DepRegistryProvider>
      <ActionsProvider>
        <ActiveToolContextProvider initialActive="select">
          <App />
        </ActiveToolContextProvider>
      </ActionsProvider>
    </DepRegistryProvider>,
  );
  return { scene, world, out, pane: getByTestId('pane') };
}

function press(el: Element, x: number, y: number): void {
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: x, clientY: y }));
  el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: x, clientY: y }));
}

describe("the lab's container", () => {
  it('is selected by a click on its solid, entered by a double-click, and left by a press outside', () => {
    const { scene, world, out, pane } = mount();
    const sphere = [...scene.childrenOf(STACK)][1];
    const box = screenBoxOf(world, sphere, VIEWPORT)!;
    const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

    act(() => press(pane, at.x, at.y));
    expect(out.selection).toEqual([STACK]);

    act(() => {
      press(pane, at.x, at.y);
      press(pane, at.x, at.y);
    });
    expect(out.entry!.entered.get()).toBe(STACK);

    act(() => press(pane, at.x + 400, at.y + 400));
    expect(out.entry!.entered.get()).toBeNull();
  });

  it('picks only inside the entered container', () => {
    const { scene, world, out } = mount();
    const outside = [...scene.roots].find((id) => id !== STACK)!;
    const box = screenBoxOf(world, outside, VIEWPORT)!;
    const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    expect(out.entry!.pick(at)).toBe(outside);
    act(() => out.entry!.entered.enter(STACK));
    expect(out.entry!.pick(at)).toBeNull();
    expect(out.entry!.boxOf(STACK)).not.toBeNull();
  });
});
