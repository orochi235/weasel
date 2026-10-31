/**
 * A warp over a selected group, and over selected text: a group's paths warp
 * together under one set of controls, and text converts to outlines when the
 * warp begins on it, the conversion and the warp landing as one undo step.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { PathBuilder } from '@weasel-js/geom';
import type { InvocationCtx, OngoingInvoker, ImmediateInvoker } from '@weasel-js/routing';
import { asNodeId } from '@weasel-js/core';
import { loadTestFont, outlineScene, TEXT } from '../shared/testing/outlineScene';
import { heldPathWarpOf } from './pathWarp';
import {
  configureWarpAction, createAddPinAction, createRemovePinAction, createWarpDragAction, expandWarpAction, type WarpHandleScratch,
} from './warpActions';
import { buildDepsFromRequires, type Action } from '@weasel-js/routing';
import type { DepRegistry } from '@weasel-js/routing/react';
import { smudgeBrushAction } from '../smudge/smudgeBrush';
import { freshWarpBox } from './warpTargets';
import { selectedWarpLeaves } from './warpSelection';
import { useDistortTool } from './useWarpTool';
import { renderHook } from '@testing-library/react';

const square = (x: number) =>
  new PathBuilder().moveTo(x, 0).lineTo(x + 100, 0).lineTo(x + 100, 100).lineTo(x, 100).close().build();

/** Drag control `index` of the fresh distort from `from` to `to`, ending with `reason`. */
function dragFresh(deps: never, from: { x: number; y: number }, to: { x: number; y: number }, reason: 'commit' | 'cancel' = 'commit') {
  const scratch: WarpHandleScratch = { warpId: null, index: 2 };
  const drag = (at: { x: number; y: number }) => ({
    start: from, current: at, delta: { x: at.x - from.x, y: at.y - from.y },
    affordance: { kind: 'layer:warp-distort', payload: scratch },
  });
  const ctx = (at: { x: number; y: number }) => ({ deps, world: at, drag: drag(at) }) as unknown as InvocationCtx;
  const handle = (createWarpDragAction('distort').invoker as OngoingInvoker).start(ctx(from), { params: {} });
  handle.onMove?.(ctx(to));
  handle.onEnd?.(ctx(to), reason);
}

beforeEach(loadTestFont);

describe('a warp over a selected group', () => {
  function groupScene() {
    const t = outlineScene();
    t.scene.add({ id: asNodeId('g'), kind: 'group', layer: 'default', pose: { x: 0, y: 0, width: 300, height: 100 }, data: {} });
    for (const [id, x] of [['a', 0], ['b', 200]] as const) {
      t.scene.add({
        id: asNodeId(id), kind: 'mark', layer: 'default', parent: asNodeId('g'),
        pose: { x, y: 0, width: 100, height: 100 }, data: { path: square(x) },
      } as never);
    }
    t.scene.setSelection([asNodeId('g')]);
    t.scene.history.clear();
    return t;
  }

  it('lays one set of controls around all of its paths', () => {
    const { scene, deps } = groupScene();
    expect(selectedWarpLeaves(deps).paths.map((n) => n.id)).toEqual(['a', 'b']);
    expect(freshWarpBox(scene, selectedWarpLeaves(deps), 'distort')).toEqual({ x: 0, y: 0, width: 300, height: 100 });
  });

  it('warps every path inside it together, as one undo step', () => {
    const { scene, deps } = groupScene();
    dragFresh(deps, { x: 300, y: 100 }, { x: 330, y: 140 });
    const a = heldPathWarpOf(scene.get(asNodeId('a'))!.data);
    const b = heldPathWarpOf(scene.get(asNodeId('b'))!.data);
    expect(a?.warp.kind).toBe('distort');
    expect(b?.id).toBe(a?.id);
    expect(scene.history.undoDepth()).toBe(1);
  });
});

describe('a warp over selected text', () => {
  function textScene(family?: string) {
    const t = outlineScene();
    t.add('t', TEXT(family));
    t.scene.setSelection([asNodeId('t')]);
    t.scene.history.clear();
    return t;
  }

  it('shows its controls around the text', () => {
    const { scene, deps } = textScene();
    expect(freshWarpBox(scene, selectedWarpLeaves(deps), 'distort')).toMatchObject({ x: 0, y: 0, width: 200, height: 120 });
  });

  it('converts the text to outlines and warps them, as one undo step', () => {
    const { scene, deps } = textScene();
    dragFresh(deps, { x: 200, y: 120 }, { x: 240, y: 160 });
    expect(scene.get(asNodeId('t'))).toBeUndefined();
    const warped = scene.renderOrderNodes().filter((n) => heldPathWarpOf(n.data));
    expect(warped.length).toBeGreaterThan(0);
    expect(scene.history.entries().undo.map((e) => e.label)).toEqual(['Distort']);
    scene.undo();
    expect(scene.get(asNodeId('t'))?.data.text).toBe('Hi');
  });

  it('puts the text back exactly when the drag is canceled', () => {
    const { scene, deps } = textScene();
    const before = JSON.stringify(scene.toJSON());
    dragFresh(deps, { x: 200, y: 120 }, { x: 240, y: 160 }, 'cancel');
    expect(JSON.stringify(scene.toJSON())).toBe(before);
    expect(scene.history.undoDepth()).toBe(0);
  });

  it('leaves text whose face has no outlines, and says so', () => {
    const { scene, deps, notices } = textScene('nowhere');
    dragFresh(deps, { x: 200, y: 120 }, { x: 240, y: 160 });
    expect(scene.get(asNodeId('t'))?.data.text).toBe('Hi');
    expect(notices.warn).toHaveBeenCalledTimes(1);
    expect(scene.history.undoDepth()).toBe(0);
  });

  it('converts the text when a pin is placed on it', () => {
    const { scene, deps } = textScene();
    (createAddPinAction().invoker as ImmediateInvoker).run(deps, { press: { x: 50, y: 50 } } as never);
    expect(scene.get(asNodeId('t'))).toBeUndefined();
    expect(scene.history.entries().undo.map((e) => e.label)).toEqual(['Add Pin']);
  });
});

describe('a warp tool', () => {
  it("hides the selection's transform handles while it is active", () => {
    const { result } = renderHook(() => useDistortTool());
    expect(result.current.hides).toEqual(['selection.resize-handles', 'selection.rotation-handle']);
  });
});

describe('the actions that read the selection through groups and text', () => {
  it('declare every dep they read', () => {
    const { deps } = outlineScene();
    const registry = { get: (name: string) => (deps as Record<string, unknown>)[name] } as unknown as DepRegistry;
    const actions: Action[] = [createAddPinAction(), createRemovePinAction(), expandWarpAction, configureWarpAction, smudgeBrushAction];
    for (const action of actions) {
      const declared = buildDepsFromRequires(action, registry);
      expect(() => action.enabled?.(declared)).not.toThrow();
      if (action.invoker?.timing === 'immediate') expect(() => (action.invoker as ImmediateInvoker).run(declared, {})).not.toThrow();
    }
  });
});
