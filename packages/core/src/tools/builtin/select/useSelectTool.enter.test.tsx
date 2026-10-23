/**
 * `group.enter` and `group.leave`: a double-click enters the group a press would select, Escape
 * and a press outside leave it. Same harness shape as the deep sibling: the tool's actions are
 * invoked directly, plus dispatcher-ranking checks against the tool's own bindings.
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
import { createEnteredGroup } from 'canvas/deps/enteredGroup';
import { escapeAction } from '../../../interactions/actions/defaults/escape';
import { useSelectTool } from './useSelectTool';
import { adapterPointQuery } from './adapterPointQuery';

type Pose = { x: number; y: number; width: number; height: number };
const NO_MODS = { alt: false, ctrl: false, meta: false, shift: false };

const box = (x: number, y = 0, w = 40, h = 40): Pose => ({ x, y, width: w, height: h });
const group = (id: string, pose: Pose, parent?: string) => ({
  id: asNodeId(id), kind: 'group' as const, layer: 'default' as const, pose, data: {},
  ...(parent ? { parent: asNodeId(parent) } : {}),
});
const mark = (id: string, pose: Pose, parent?: string) => ({
  id: asNodeId(id), kind: 'mark' as const, layer: 'default' as const, pose, data: {},
  ...(parent ? { parent: asNodeId(parent) } : {}),
});

function harness(initial: UseSceneOptions<unknown, 'default', Pose>['initial']) {
  const { result } = renderHook(() => {
    const scene = useScene<unknown, 'default', Pose>({ systemLayers: [{ id: 'default' }], initial });
    const sel = useSelection({ mode: 'multi' });
    const adapter = sceneToAdapter(scene, { selection: sel });
    const options = {
      pickEvery: (x: number, y: number) =>
        pickWalk(scenePickSource(scene), adapterPointQuery(AUTO_POSE_DESCRIPTOR, false)(x, y, 0)),
    };
    return { tool: useSelectTool(adapter as never, options as never), sel, scene };
  });
  const entered = createEnteredGroup(result.current.scene);
  const extra: Record<string, unknown> = {};
  const deps = () => ({ selection: result.current.sel, enteredGroup: entered, ...extra }) as unknown as ActionDeps;
  const action = (id: string) => {
    const a = (result.current.tool as { actions?: readonly Action[] }).actions?.find((x) => x.id === id);
    if (!a) throw new Error(`${id} missing`);
    return a;
  };
  const run = (id: string, point?: { x: number; y: number }) => {
    const a = action(id);
    if (a.invoker?.timing !== 'immediate') throw new Error(`${id} not immediate`);
    const invoker = a.invoker;
    act(() => {
      invoker.run(deps(), point ? { worldX: point.x, worldY: point.y, mods: NO_MODS } : {});
    });
  };
  return {
    entered,
    extra,
    action,
    scene: () => result.current.scene,
    selection: () => [...result.current.sel.current],
    tool: () => result.current.tool,
    canEnter: (x: number, y: number) => action('group.enter').enabled?.(deps(), { x, y }) === true,
    enter: (x: number, y: number) => run('group.enter', { x, y }),
    pick: (x: number, y: number) => run('select.pick', { x, y }),
    leaveKey: () => run('group.leave'),
    canLeaveKey: () => action('group.leave').enabled?.(deps(), undefined) === true,
    canLeaveAt: (x: number, y: number) => action('group.leave').enabled?.(deps(), { x, y }) === true,
    leaveAt: (x: number, y: number) => run('group.leave', { x, y }),
  };
}

const NESTED = [
  group('outer', box(0)),
  group('inner', box(0, 0, 30, 30), 'outer'),
  mark('m', box(0, 0, 10, 10), 'inner'),
  mark('sibling', box(32, 0, 8, 8), 'outer'),
  mark('free', box(100, 100, 10, 10)),
];

describe('group.enter', () => {
  it('a double-click on a member enters its group, and a press then selects the member', () => {
    const h = harness([group('g', box(0)), mark('a', box(0, 0, 10, 10), 'g'), mark('b', box(20, 0, 10, 10), 'g')]);
    h.pick(5, 5);
    expect(h.selection()).toEqual(['g']);
    expect(h.canEnter(5, 5)).toBe(true);
    h.enter(5, 5);
    expect(h.entered.get()).toBe('g');
    h.pick(25, 5);
    expect(h.selection()).toEqual(['b']);
  });

  it('a second double-click on a member of a nested group enters that group', () => {
    const h = harness(NESTED);
    h.enter(5, 5);
    expect(h.entered.get()).toBe('outer');
    h.enter(5, 5);
    expect(h.entered.get()).toBe('inner');
  });

  it('declines on a member that is not a group, so the next double-click binding runs', () => {
    const h = harness(NESTED);
    h.enter(5, 5);
    expect(h.canEnter(35, 4)).toBe(false);
    expect(h.canEnter(105, 105)).toBe(false);
  });

  it('declines on empty canvas', () => {
    expect(harness(NESTED).canEnter(500, 500)).toBe(false);
  });

  it('is not eligible in isolation mode, whose own double-click drills in', () => {
    expect(harness([]).action('group.enter').eligible).toEqual({ capability: 'creates-selection', mode: { not: 'isolation' } });
  });

  it('declares every dep it reads', () => {
    const a = harness([]).action('group.enter') as Action & { requires?: string[] };
    expect(a.requires).toEqual(['enteredGroup']);
  });
});

describe('group.leave', () => {
  it('Escape leaves one level at a time, then declines so Escape clears the selection', () => {
    const h = harness(NESTED);
    h.entered.enter(asNodeId('inner'));
    expect(h.canLeaveKey()).toBe(true);
    h.leaveKey();
    expect(h.entered.get()).toBe('outer');
    h.leaveKey();
    expect(h.entered.get()).toBeNull();
    expect(h.canLeaveKey()).toBe(false);
  });

  it('declines Escape while path anchors are being edited', () => {
    const h = harness(NESTED);
    h.entered.enter(asNodeId('outer'));
    h.extra.editAnchors = { editingId: 'm' };
    expect(h.canLeaveKey()).toBe(false);
  });

  it('a press outside the entered group box leaves it, and one inside does not', () => {
    const h = harness(NESTED);
    h.entered.enter(asNodeId('outer'));
    expect(h.canLeaveAt(20, 20)).toBe(false);
    expect(h.canLeaveAt(300, 300)).toBe(true);
    h.leaveAt(300, 300);
    expect(h.entered.get()).toBeNull();
  });

  it('a press outside both levels leaves both; one inside the outer only leaves the inner', () => {
    const h = harness(NESTED);
    h.entered.enter(asNodeId('inner'));
    h.leaveAt(35, 35);
    expect(h.entered.get()).toBe('outer');
    h.entered.enter(asNodeId('inner'));
    h.leaveAt(300, 300);
    expect(h.entered.get()).toBeNull();
  });

  it('select.pick on a node outside the entered group leaves it and selects that node', () => {
    const h = harness(NESTED);
    h.entered.enter(asNodeId('outer'));
    h.pick(105, 105);
    expect(h.entered.get()).toBeNull();
    expect(h.selection()).toEqual(['free']);
  });

  it('declares every dep it reads', () => {
    const a = harness([]).action('group.leave') as Action & { requires?: string[] };
    expect(a.requires).toEqual(['enteredGroup', 'editAnchors']);
  });
});

describe('undo while a group is entered', () => {
  it('deleting the entered group leaves its parent entered, and undo restores it', () => {
    const h = harness(NESTED);
    h.entered.enter(asNodeId('inner'));
    act(() => { h.scene().remove(asNodeId('inner')); });
    expect(h.entered.get()).toBe('outer');
    act(() => { h.scene().history.undo(); });
    expect(h.entered.get()).toBe('inner');
  });
});

describe('bindings', () => {
  const scoped = (h: ReturnType<typeof harness>): ScopedBinding[] =>
    (h.tool() as unknown as { bindings: ScopedBinding['binding'][] }).bindings
      .map((binding) => ({ binding, scope: 'active' as const, ownerId: 'select' }));
  const pointer = { x: 0, y: 0, clientX: 0, clientY: 0, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };

  it('a double-click on a body ranks group.enter above an ambient body double-click', () => {
    const h = harness([]);
    const ambient: ScopedBinding = {
      binding: { spec: { kind: 'doubleClick', target: 'unselected-body' }, actionId: 'enterPathEdit', opts: { id: 'enterPathEdit.doubleClick' } } as ScopedBinding['binding'],
      scope: 'ambient' as const, ownerId: 'paths',
    };
    const event = { kind: 'doubleclick' as const, ...pointer, bodyTarget: 'unselected-body' as const, stage: 'press' as const };
    const ranked = matchSorted(event as never, [ambient, ...scoped(h)], true);
    expect(ranked[0]?.binding.actionId).toBe('group.enter');
  });

  it('Escape ranks group.leave above the escape action that clears the selection', () => {
    const h = harness([]);
    const esc: ScopedBinding[] = (escapeAction.defaultBinding ?? []).map((binding) => ({
      binding: { ...binding, actionId: 'escape' } as ScopedBinding['binding'], scope: 'ambient' as const, ownerId: 'edit',
    }));
    const event = { kind: 'key' as const, key: 'Escape', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
    const ranked = matchSorted(event as never, [...esc, ...scoped(h)], true);
    expect(ranked[0]?.binding.actionId).toBe('group.leave');
  });
});
