/**
 * A press resolves to the outermost group above the node under the point,
 * below the entered group. Same harness shape as the leaf-picking sibling:
 * press a world point through `select.pick` and read what is selected.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { sceneToAdapter } from 'canvas/sceneAdapter';
import { useScene } from 'core/scene/useScene';
import type { UseSceneOptions } from 'core/scene/types';
import { useSelection } from 'core/selection/useSelection';
import { useSelectTool } from './useSelectTool';
import { asNodeId } from 'core/scene/types';
import { pickTopMostHit } from '../pickTopMostHit';
import { scenePoseFrame } from 'interactions/actions/poseFrame';
import { moveAction } from 'interactions/actions/move/action';
import type { Action, ActionDeps, InvocationCtx } from '@weasel-js/routing';

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
) {
  const { result } = renderHook(() => {
    const scene = useScene<unknown, 'default', Pose>({ systemLayers: [{ id: 'default' }], initial });
    const sel = useSelection({ mode: 'multi' });
    const adapter = sceneToAdapter(scene, { selection: sel });
    return { tool: useSelectTool(adapter as never, {} as never), sel, scene };
  });
  return {
    scene: () => result.current.scene,
    sel: () => result.current.sel,
    press(x: number, y: number, mods: Partial<Mods> = {}) {
      const tool = result.current.tool as { actions?: readonly Action[] };
      const invoker = tool.actions?.find((a) => a.id === 'select.pick')?.invoker;
      if (invoker?.timing !== 'immediate') throw new Error('select.pick missing');
      act(() => {
        invoker.run(
          { selection: result.current.sel, enteredGroup: { get: () => entered } } as unknown as ActionDeps,
          { worldX: x, worldY: y, mods: { ...NO_MODS, ...mods } },
        );
      });
    },
    selection: () => [...result.current.sel.current],
  };
}

describe('select.pick on groups', () => {
  it('a press on a member selects its group', () => {
    const h = harness([group('g', box(0)), mark('m', box(0, 0, 20, 20), 'g')]);
    h.press(5, 5);
    expect(h.selection()).toEqual(['g']);
  });

  it('a press on a nested member selects the outermost group', () => {
    const h = harness([
      group('outer', box(0)),
      group('inner', box(0, 0, 30, 30), 'outer'),
      mark('m', box(0, 0, 10, 10), 'inner'),
    ]);
    h.press(5, 5);
    expect(h.selection()).toEqual(['outer']);
  });

  it('a press inside the entered group stops below it', () => {
    const h = harness([
      group('outer', box(0)),
      group('inner', box(0, 0, 30, 30), 'outer'),
      mark('m', box(0, 0, 10, 10), 'inner'),
    ], 'outer');
    h.press(5, 5);
    expect(h.selection()).toEqual(['inner']);
  });

  it("a press on a member under the point selects that member's group, never a sibling group behind it", () => {
    const h = harness([
      group('behind', box(0)),
      mark('b1', box(0, 0, 40, 40), 'behind'),
      group('front', box(10, 10, 20, 20)),
      mark('f1', box(10, 10, 20, 20), 'front'),
    ]);
    h.press(15, 15);
    expect(h.selection()).toEqual(['front']);
  });

  it("shift-press on a second group's member adds that group", () => {
    const h = harness([
      group('a', box(0)), mark('am', box(0, 0, 20, 20), 'a'),
      group('b', box(100)), mark('bm', box(100, 0, 20, 20), 'b'),
    ]);
    h.press(5, 5);
    h.press(105, 5, { shift: true });
    expect(h.selection()).toEqual(['a', 'b']);
  });

  it('cmd-press does not extend', () => {
    const h = harness([
      group('a', box(0)), mark('am', box(0, 0, 20, 20), 'a'),
      group('b', box(100)), mark('bm', box(100, 0, 20, 20), 'b'),
    ]);
    h.press(5, 5);
    h.press(105, 5, { meta: true });
    expect(h.selection()).toEqual(['b']);
  });

  it("a press on the empty part of a group's box selects it", () => {
    const h = harness([group('g', box(0)), mark('m', box(0, 0, 10, 10), 'g')]);
    h.press(35, 35);
    expect(h.selection()).toEqual(['g']);
  });

  it('a press on an emptied group selects it', () => {
    const h = harness([group('g', box(0))]);
    h.press(20, 20);
    expect(h.selection()).toEqual(['g']);
  });

  it('a press on a locked member still selects its unlocked group', () => {
    const h = harness([group('g', box(0)), mark('m', box(0, 0, 20, 20), 'g', { locked: true })]);
    h.press(5, 5);
    expect(h.selection()).toEqual(['g']);
  });

  it('pressing a member of the selected group again keeps the group selected, so the press can drag it', () => {
    const h = harness([group('g', box(0)), mark('m', box(0, 0, 20, 20), 'g')]);
    h.press(5, 5);
    h.press(6, 6);
    expect(h.selection()).toEqual(['g']);
  });
});

describe('dragging a member of a group', () => {
  it('moves the group, and the member rides along', () => {
    const h = harness([group('g', box(0)), mark('m', box(0, 0, 20, 20), 'g')]);
    h.press(5, 5);
    const base = {
      world: { x: 5, y: 5 },
      modifiers: NO_MODS,
      deps: { selection: h.sel(), scene: h.scene() },
    };
    const inv = moveAction.invoker;
    if (!inv || inv.timing !== 'ongoing') throw new Error('expected ongoing invoker');
    const handle = inv.start(base as unknown as InvocationCtx, undefined);
    const moved = {
      ...base,
      drag: { start: { x: 5, y: 5 }, current: { x: 15, y: 12 }, delta: { x: 10, y: 7 } },
    } as unknown as InvocationCtx;
    act(() => {
      handle.onMove!(moved);
      handle.onEnd!(moved, 'commit');
    });
    const scene = h.scene();
    expect(scene.get(asNodeId('g'))?.pose).toMatchObject({ x: 10, y: 7 });
    // Stored in the group's frame, which carries it.
    expect(scene.get(asNodeId('m'))?.pose).toMatchObject({ x: 0, y: 0 });
    expect(scenePoseFrame(scene).world(asNodeId('m'))).toMatchObject({ x: 10, y: 7 });
  });
});

describe('pickTopMostHit with a group and its member', () => {
  const parentOf: Record<string, string | null> = { g: null, m: 'g' };
  const adapter = { getParent: (id: string) => parentOf[id] ?? null };

  it('a member under the point beats its group as the hit node', () => {
    expect(pickTopMostHit(['g', 'm'], adapter)).toBe('m');
    expect(pickTopMostHit(['m', 'g'], adapter)).toBe('m');
  });
});
