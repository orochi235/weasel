/**
 * `select.deep`: Cmd-press selects the node under the point, past every group.
 * Same harness shape as the groups sibling: invoke the tool's actions directly,
 * plus one dispatcher-ranking check against the tool's own bindings.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { matchSorted, type ScopedBinding } from '@weasel-js/routing';
import type { Action, ActionDeps } from '@weasel-js/routing';
import { sceneToAdapter } from 'canvas/sceneAdapter';
import { useScene } from 'core/scene/useScene';
import type { UseSceneOptions } from 'core/scene/types';
import { useSelection } from 'core/selection/useSelection';
import { asNodeId } from 'core/scene/types';
import { scenePickSource } from 'canvas/scenePickSource';
import { pickWalk } from 'canvas/pickWalk';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import { useSelectTool } from './useSelectTool';
import { adapterPointQuery } from './adapterPointQuery';

type Pose = { x: number; y: number; width: number; height: number };
type Mods = { alt: boolean; ctrl: boolean; meta: boolean; shift: boolean };
const NO_MODS: Mods = { alt: false, ctrl: false, meta: false, shift: false };

const box = (x: number, y = 0, w = 40, h = 40): Pose => ({ x, y, width: w, height: h });
const group = (id: string, pose: Pose, parent?: string) => ({
  id: asNodeId(id), kind: 'group' as const, layer: 'default' as const, pose, data: {},
  ...(parent ? { parent: asNodeId(parent) } : {}),
});
const mark = (id: string, pose: Pose, parent?: string, extra = {}) => ({
  id: asNodeId(id), kind: 'mark' as const, layer: 'default' as const, pose, data: {},
  ...(parent ? { parent: asNodeId(parent) } : {}), ...extra,
});

function harness(
  initial: UseSceneOptions<unknown, 'default', Pose>['initial'],
  entered: string | null = null,
  scenePicking = false,
) {
  const { result } = renderHook(() => {
    const scene = useScene<unknown, 'default', Pose>({ systemLayers: [{ id: 'default' }], initial });
    const sel = useSelection({ mode: 'multi' });
    const adapter = sceneToAdapter(scene, { selection: sel });
    const options = scenePicking
      ? { pickEvery: (x: number, y: number) => pickWalk(scenePickSource(scene), adapterPointQuery(AUTO_POSE_DESCRIPTOR, false)(x, y, 0)) }
      : {};
    return { tool: useSelectTool(adapter as never, options as never), sel };
  });
  const run = (actionId: string, x: number, y: number, mods: Partial<Mods>) => {
    const tool = result.current.tool as { actions?: readonly Action[] };
    const invoker = tool.actions?.find((a) => a.id === actionId)?.invoker;
    if (invoker?.timing !== 'immediate') throw new Error(`${actionId} missing`);
    act(() => {
      invoker.run(
        { selection: result.current.sel, enteredGroup: { get: () => entered } } as unknown as ActionDeps,
        { worldX: x, worldY: y, mods: { ...NO_MODS, ...mods } },
      );
    });
  };
  return {
    deep: (x: number, y: number, mods: Partial<Mods> = { meta: true }) => run('select.deep', x, y, mods),
    pick: (x: number, y: number, mods: Partial<Mods> = {}) => run('select.pick', x, y, mods),
    selection: () => [...result.current.sel.current],
    tool: () => result.current.tool,
  };
}

describe('select.deep', () => {
  it('a Cmd-press on a member two groups deep selects that member', () => {
    const h = harness([
      group('outer', box(0)),
      group('inner', box(0, 0, 30, 30), 'outer'),
      mark('m', box(0, 0, 10, 10), 'inner'),
    ]);
    h.deep(5, 5);
    expect(h.selection()).toEqual(['m']);
  });

  it('a Cmd-Shift-press adds a second member', () => {
    const h = harness([
      group('g', box(0)),
      mark('a', box(0, 0, 10, 10), 'g'),
      mark('b', box(20, 0, 10, 10), 'g'),
    ]);
    h.deep(5, 5);
    h.deep(25, 5, { meta: true, shift: true });
    expect(h.selection()).toEqual(['a', 'b']);
  });

  it('a Cmd-press on the empty part of a group selects the group itself', () => {
    const h = harness([group('g', box(0)), mark('m', box(0, 0, 10, 10), 'g')]);
    h.deep(35, 35);
    expect(h.selection()).toEqual(['g']);
  });

  it('a Cmd-press on a locked member does not select it', () => {
    const h = harness([
      group('g', box(0, 0, 10, 10)),
      mark('m', box(0, 0, 10, 10), 'g', { locked: true }),
    ], null, true);
    h.deep(5, 5);
    expect(h.selection()).toEqual(['g']);
  });

  it('settles a deferred click left by an earlier select.pick', () => {
    const h = harness([mark('a', box(0, 0, 10, 10)), mark('b', box(20, 0, 10, 10))]);
    h.pick(5, 5);
    h.pick(25, 5, { shift: true });
    h.pick(5, 5);
    h.deep(25, 5);
    const collapse = (h.tool() as { actions?: readonly Action[] }).actions
      ?.find((a) => a.id === 'select.collapseDeferred');
    expect(collapse?.enabled?.()).not.toBe(true);
  });
});

describe('a plain press inside an entered group', () => {
  it('on a member that is itself a group selects that group', () => {
    const h = harness([
      group('outer', box(0)),
      group('inner', box(0, 0, 30, 30), 'outer'),
      mark('m', box(0, 0, 10, 10), 'inner'),
    ], 'outer');
    h.pick(5, 5);
    expect(h.selection()).toEqual(['inner']);
  });
});

describe('select.deep binding', () => {
  it('declares every dep it reads', () => {
    const deep = (harness([]).tool() as { actions?: readonly (Action & { requires?: string[] })[] })
      .actions?.find((a) => a.id === 'select.deep');
    expect(deep?.requires).toEqual(['selection', 'enteredGroup']);
  });

  it('wins a Cmd-press over select.pick, with or without Shift', () => {
    const tool = harness([]).tool() as unknown as { bindings: ScopedBinding['binding'][] };
    const scoped: ScopedBinding[] = tool.bindings.map((binding) => ({
      binding, scope: 'active' as const, ownerId: 'select',
    }));
    const down = (mods: Partial<{ metaKey: boolean; shiftKey: boolean }>) => ({
      kind: 'pointerdown' as const,
      x: 0, y: 0, clientX: 0, clientY: 0,
      altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
      bodyTarget: 'unselected-body' as const,
      stage: 'press' as const,
      ...mods,
    });
    expect(matchSorted(down({ metaKey: true }), scoped, true)[0]?.binding.actionId).toBe('select.deep');
    expect(matchSorted(down({ metaKey: true, shiftKey: true }), scoped, true)[0]?.binding.actionId).toBe('select.deep');
    expect(matchSorted(down({}), scoped, true)[0]?.binding.actionId).toBe('select.pick');
    expect(matchSorted(down({ shiftKey: true }), scoped, true)[0]?.binding.actionId).toBe('select.pick');
  });
});
