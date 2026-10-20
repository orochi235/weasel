import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Action, ActionDeps, InvocationCtx } from '@weasel-js/routing';
import type { Skeleton } from '@weasel-js/animator';
import { createScene, toolIdsOf } from '@weasel-js/core';
import { RIG_TOOLS } from './toolSets';
import type { NodeId, RectPose, Tool } from '@weasel-js/core';
import { createRigEditState } from './bone/rigEditState';
import { rigOfSelection, useRigTools, type UseRigToolsOptions } from './useRigTools';

type Data = { skeleton?: Skeleton; label?: string };

const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const MODS = { alt: false, ctrl: false, meta: false, shift: false };
const deps = { view: { get: () => VIEW, set: () => {} } } as unknown as ActionDeps;
const ARM: Skeleton = { joints: [{ name: 'root', parent: null, bind: { x: 10, y: 10, rotation: 0, scaleX: 1, scaleY: 1 } }] };

function sceneWithRig() {
  const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const box = { x: 100, y: 100, width: 200, height: 100 };
  const rig = scene.add({ kind: 'container', layer: 'main', pose: box, data: { skeleton: ARM } });
  const sleeve = scene.add({ kind: 'leaf', layer: 'main', parent: rig, pose: box, data: {} });
  const loose = scene.add({ kind: 'leaf', layer: 'main', pose: box, data: { label: 'loose' } });
  return { scene, rig, sleeve, loose };
}

const actionOf = (tool: Tool, id: string): Action => {
  const a = (tool.actions ?? []).find((x) => x.id === id);
  if (!a) throw new Error(`${id} not declared on ${tool.id}`);
  return a;
};
const ctx = (x: number, y: number, from = { x, y }): InvocationCtx => ({
  world: { x, y }, screen: { x, y }, modifiers: MODS, deps,
  drag: { start: from, current: { x, y }, delta: { x: x - from.x, y: y - from.y } },
});
/** Draw a bone with the bone tool from `from` to `to`, committing it. */
function drawBone(bone: Tool, from: [number, number], to: [number, number]): void {
  const invoker = actionOf(bone, 'bone.drag').invoker;
  if (invoker?.timing !== 'ongoing') throw new Error('bone.drag is not ongoing');
  const handle = invoker.start(ctx(from[0], from[1]), undefined);
  handle.onMove?.(ctx(to[0], to[1], { x: from[0], y: from[1] }));
  handle.onEnd?.({ ...ctx(to[0], to[1]), deps: {} as ActionDeps }, 'commit');
}
const enabled = (tool: Tool, id: string): boolean => actionOf(tool, id).enabled?.(deps) === true;

describe('rigOfSelection', () => {
  it('resolves a selected path to the ancestor holding the skeleton', () => {
    const { scene, rig, sleeve } = sceneWithRig();
    expect(rigOfSelection(scene, [sleeve])).toBe(rig);
    expect(rigOfSelection(scene, [rig])).toBe(rig);
  });

  it('falls back to the selected node itself when nothing above it has a skeleton', () => {
    const { scene, loose } = sceneWithRig();
    expect(rigOfSelection(scene, [loose])).toBe(loose);
  });

  it('is null with nothing or several selected', () => {
    const { scene, rig, loose } = sceneWithRig();
    expect(rigOfSelection(scene, [])).toBeNull();
    expect(rigOfSelection(scene, [rig, loose])).toBeNull();
  });
});

describe('useRigTools', () => {
  function setup(options?: Omit<UseRigToolsOptions, 'scene' | 'selection'>) {
    const t = sceneWithRig();
    let selected: NodeId[] = [];
    const { result } = renderHook(() => useRigTools({
      scene: t.scene as never, selection: () => selected, ...options,
    }));
    return { ...t, tools: () => result.current, select: (ids: NodeId[]) => { selected = ids; } };
  }

  it('reads the selection when a tool acts, not when it mounts', () => {
    const t = setup();
    expect(enabled(t.tools().bone, 'bone.pick')).toBe(false);
    t.select([t.loose]);
    drawBone(t.tools().bone, [150, 150], [200, 150]);
    expect(t.scene.get(t.loose)!.data.skeleton?.joints).toHaveLength(2);
  });

  it('draws onto the skeleton-bearing ancestor of a selected path', () => {
    const t = setup();
    t.select([t.sleeve]);
    drawBone(t.tools().bone, [200, 150], [250, 150]);
    expect(t.scene.get(t.rig)!.data.skeleton?.joints.length).toBeGreaterThan(1);
    expect(t.scene.get(t.sleeve)!.data.skeleton).toBeUndefined();
  });

  it('shares one joint between bone and weight', () => {
    const t = setup();
    t.select([t.rig]);
    expect(enabled(t.tools().weight, 'weight.paint')).toBe(false);
    drawBone(t.tools().bone, [200, 150], [250, 150]);
    expect(enabled(t.tools().weight, 'weight.paint')).toBe(true);
  });

  it('takes a fixed rig and a shared state from its options', () => {
    const state = createRigEditState();
    let fixed: NodeId | null = null;
    const t = setup({ rig: () => fixed, state });
    fixed = t.loose;
    drawBone(t.tools().bone, [150, 150], [200, 150]);
    expect(t.scene.get(t.loose)!.data.skeleton?.joints).toHaveLength(2);
    expect(state.active()).not.toBeNull();
  });

  it('keys its tools by the ids RIG_TOOLS names', () => {
    const t = setup();
    expect(Object.keys(t.tools())).toEqual(toolIdsOf([RIG_TOOLS]));
  });

  it('declares both tools as editing the page', () => {
    const t = setup();
    expect(t.tools().bone.eligibility?.capabilities).toEqual(['edits-page']);
    expect(t.tools().weight.eligibility?.capabilities).toEqual(['edits-page']);
  });

  it("reads the scene's own selection when given none", () => {
    const t = sceneWithRig();
    const { result } = renderHook(() => useRigTools({ scene: t.scene as never }));
    t.scene.setSelection([t.sleeve]);
    drawBone(result.current.bone, [200, 150], [250, 150]);
    expect(t.scene.get(t.rig)!.data.skeleton?.joints.length).toBeGreaterThan(1);
  });
});
