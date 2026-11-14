import { describe, expect, it } from 'vitest';
import { PathBuilder } from '@weasel-js/geom';
import type { InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import { IDENTITY_POSE_COMPOSITION, asNodeId, createScene, type EditableShape, type Scene } from '@weasel-js/core';
import { heldPathWarpOf, resolvePathWarp } from './pathWarp';
import { createWarpDragAction } from './warpActions';

type S = Scene<unknown, string, unknown>;

const depsOf = (scene: S) => ({
  scene,
  selection: { get: () => ['a'], set: () => {}, clear: () => {} },
}) as unknown as InvocationCtx['deps'];

/** A square warped by dragging one corner of a plane warp. */
function warpedSquare(): EditableShape {
  const square = new PathBuilder().moveTo(0, 0).lineTo(100, 0).lineTo(100, 100).lineTo(0, 100).close().build();
  const scene = createScene<unknown, 'main', unknown>({
    composition: IDENTITY_POSE_COMPOSITION,
    systemLayers: [{ id: 'main' }],
    initial: [{ id: asNodeId('a'), kind: 'mark', layer: 'main', pose: square, data: {} }],
  }) as unknown as S;
  const from = { x: 100, y: 100 }, to = { x: 125, y: 110 };
  const ctx = (at: { x: number; y: number }): InvocationCtx => ({
    world: at, modifiers: { alt: false, ctrl: false, meta: false, shift: false }, deps: depsOf(scene),
    drag: {
      start: from, current: at, delta: { x: at.x - from.x, y: at.y - from.y },
      affordance: { kind: 'layer:warp-plane', payload: { warpId: null, index: 2 } },
    },
  });
  const handle = (createWarpDragAction('plane').invoker as OngoingInvoker).start(ctx(from), { params: {} });
  handle.onMove?.(ctx(to));
  handle.onEnd?.(ctx(to), 'commit');
  return scene.get(asNodeId('a'))! as unknown as EditableShape;
}

/** `node` as a save from before the rename holds it, with its warp under `kind`. */
function savedAs(node: EditableShape, kind: string): EditableShape {
  const data = node.data as { warp: { warp: object } };
  return { ...node, data: { ...data, warp: { ...data.warp, warp: { ...data.warp.warp, kind } } } } as EditableShape;
}

describe('a warp saved under a kind it was renamed from', () => {
  it('resolves a distort as the plane warp it now is', () => {
    const node = warpedSquare();
    const old = savedAs(node, 'distort');
    const resolved = resolvePathWarp(old);
    expect(resolved?.held.warp.kind).toBe('plane');
    expect(resolved?.held.warp).toEqual(resolvePathWarp(node)!.held.warp);
    expect(heldPathWarpOf(old.data)).toBe(heldPathWarpOf(old.data));
  });

  it('reads an envelope as cloth and a puppet as pin', () => {
    const node = warpedSquare();
    expect(heldPathWarpOf(savedAs(node, 'envelope').data)?.warp.kind).toBe('cloth');
    expect(heldPathWarpOf(savedAs(node, 'puppet').data)?.warp.kind).toBe('pin');
  });
});
