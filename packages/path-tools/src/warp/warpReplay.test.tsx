/**
 * The warps as the last operation: a control drag replayed with the warp
 * remade under other settings, and a `configureWarp` run rerun, each as one
 * undo entry, over paths, a group, and text converted when the drag began.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { act } from '@testing-library/react';
import { PathBuilder } from '@weasel-js/geom';
import type { InvocationCtx } from '@weasel-js/routing';
import { asNodeId } from '@weasel-js/core';
import { loadTestFont, outlineScene, TEXT } from '../shared/testing/outlineScene';
import { lastOperationHarness } from '../shared/testing/lastOperation';
import { heldPathWarpOf } from './pathWarp';
import { configureWarpAction, createWarpDragAction, type WarpHandleScratch } from './warpActions';
import type { WarpKind } from './warpTargets';

type Pt = { x: number; y: number };
const square = (x: number) =>
  new PathBuilder().moveTo(x, 0).lineTo(x + 100, 0).lineTo(x + 100, 100).lineTo(x, 100).close().build();

function setup() {
  const t = outlineScene();
  const actions = [createWarpDragAction('distort'), createWarpDragAction('envelope'), configureWarpAction];
  const harness = lastOperationHarness(t.deps as Record<string, unknown>, actions);
  const addSquare = (id: string, x: number, parent?: string) => t.scene.add({
    id: asNodeId(id), kind: 'mark', layer: 'default', ...(parent ? { parent: asNodeId(parent) } : {}),
    pose: { x, y: 0, width: 100, height: 100 }, data: { path: square(x) },
  } as never);
  /** Drag control `index` of the selection's `kind` warp (`warpId` null for a fresh one) from `from` to `to`. */
  const drag = (kind: WarpKind, warpId: string | null, index: number, from: Pt, to: Pt, params: Record<string, unknown> = {}) => {
    const scratch: WarpHandleScratch = { warpId, index };
    const ctx = (at: Pt) => ({
      deps: t.deps, world: at,
      drag: { start: from, current: at, delta: { x: at.x - from.x, y: at.y - from.y }, affordance: { kind: `layer:warp-${kind}`, payload: scratch } },
    }) as unknown as InvocationCtx;
    act(() => {
      const handle = harness.start(`${kind}.drag`, ctx(from), params);
      handle.onMove?.(ctx(to));
      handle.onEnd?.(ctx(to), 'commit');
    });
  };
  const warpOf = (id: string) => heldPathWarpOf(t.scene.get(asNodeId(id))?.data);
  return { ...t, ...harness, addSquare, drag, warpOf };
}

beforeEach(loadTestFont);

describe('a warp drag in the last-operation panel', () => {
  it('replays a fresh distort as Perspective, the corner where it was dragged, as one undo entry', () => {
    const { scene, addSquare, drag, warpOf, store, adjust } = setup();
    addSquare('a', 0);
    scene.setSelection([asNodeId('a')]);
    scene.history.clear();
    drag('distort', null, 2, { x: 100, y: 100 }, { x: 140, y: 130 });
    expect(store.get()).toMatchObject({ id: 'distort.drag', label: 'Distort', values: { mode: 'free', tolerance: 0.5 } });
    const free = warpOf('a')!;
    adjust({ mode: 'perspective' });
    const persp = warpOf('a')!;
    expect(persp.warp).toMatchObject({ kind: 'distort', mode: 'perspective' });
    expect(persp.warp.kind === 'distort' && free.warp.kind === 'distort' && persp.warp.corners).toEqual(free.warp.kind === 'distort' && free.warp.corners);
    expect(scene.history.entries().undo.map((e) => e.label)).toEqual(['Distort']);
    expect([...scene.getSelection()]).toEqual(['a']);
    act(() => { scene.undo(); });
    expect(warpOf('a')).toBeNull();
  });

  it("shows a held warp's own settings, so a change to one leaves the rest as the warp had them", () => {
    const { scene, addSquare, drag, warpOf, store, adjust } = setup();
    addSquare('a', 0);
    scene.setSelection([asNodeId('a')]);
    drag('distort', null, 2, { x: 100, y: 100 }, { x: 140, y: 130 }, { mode: 'perspective' });
    const id = warpOf('a')!.id;
    scene.history.clear();
    // The binding's settings say Free; the warp the drag moves is Perspective.
    drag('distort', id, 0, { x: 0, y: 0 }, { x: -20, y: -10 }, { mode: 'free' });
    expect(store.get()?.values).toEqual({ mode: 'perspective', tolerance: 0.5 });
    adjust({ tolerance: 2 });
    expect(warpOf('a')).toMatchObject({ tolerance: 2, warp: { mode: 'perspective' } });
    expect(scene.history.undoDepth()).toBe(1);
  });

  it("resamples a held envelope's bent mesh at a new grid", () => {
    const { scene, addSquare, drag, warpOf, adjust } = setup();
    addSquare('a', 0);
    scene.setSelection([asNodeId('a')]);
    drag('envelope', null, 0, { x: 0, y: 0 }, { x: -30, y: -20 });
    const bent = warpOf('a')!;
    scene.history.clear();
    drag('envelope', bent.id, 0, { x: -30, y: -20 }, { x: -40, y: -25 });
    adjust({ rows: 5, cols: 4 });
    const mesh = warpOf('a')!.warp;
    expect(mesh.kind === 'envelope' && [mesh.mesh.rows, mesh.mesh.cols]).toEqual([5, 4]);
    expect(scene.history.undoDepth()).toBe(1);
  });

  it('replays over a selected group, every path under the remade warp', () => {
    const { scene, addSquare, drag, warpOf, adjust } = setup();
    scene.add({ id: asNodeId('g'), kind: 'group', layer: 'default', pose: { x: 0, y: 0, width: 300, height: 100 }, data: {} } as never);
    addSquare('a', 0, 'g');
    addSquare('b', 200, 'g');
    scene.setSelection([asNodeId('g')]);
    scene.history.clear();
    drag('distort', null, 2, { x: 300, y: 100 }, { x: 330, y: 140 });
    adjust({ mode: 'perspective' });
    expect(warpOf('a')?.warp).toMatchObject({ mode: 'perspective' });
    expect(warpOf('b')?.id).toBe(warpOf('a')?.id);
    expect(scene.history.undoDepth()).toBe(1);
    expect([...scene.getSelection()]).toEqual(['g']);
  });

  it('converts text again on replay, conversion and warp one undo entry', () => {
    const { scene, add, drag, adjust } = setup();
    add('t', TEXT());
    scene.setSelection([asNodeId('t')]);
    scene.history.clear();
    drag('distort', null, 2, { x: 200, y: 120 }, { x: 240, y: 160 });
    adjust({ tolerance: 1.5 });
    expect(scene.get(asNodeId('t'))).toBeUndefined();
    const warped = scene.renderOrderNodes().map((n) => heldPathWarpOf(n.data)).filter((w) => w !== null);
    expect(warped.length).toBeGreaterThan(0);
    expect(warped.every((w) => w!.tolerance === 1.5)).toBe(true);
    expect(scene.history.entries().undo.map((e) => e.label)).toEqual(['Distort']);
    act(() => { scene.undo(); });
    expect(scene.get(asNodeId('t'))?.data.text).toBe('Hi');
    expect([...scene.getSelection()]).toEqual(['t']);
  });
});

describe('Warp Settings in the last-operation panel', () => {
  it('shows only the setting a run changed, and reruns it in place', () => {
    const { scene, addSquare, drag, warpOf, registry, store, adjust } = setup();
    addSquare('a', 0);
    scene.setSelection([asNodeId('a')]);
    drag('envelope', null, 0, { x: 0, y: 0 }, { x: -30, y: -20 });
    scene.history.clear();
    act(() => { registry.trigger('configureWarp', { kind: 'envelope', rows: 4 }); });
    expect(store.get()).toMatchObject({ id: 'configureWarp', values: { rows: 4 } });
    expect(Object.keys(store.get()!.values)).toEqual(['rows']);
    adjust({ rows: 6 });
    const mesh = warpOf('a')!.warp;
    expect(mesh.kind === 'envelope' && [mesh.mesh.rows, mesh.mesh.cols]).toEqual([6, 3]);
    expect(scene.history.undoDepth()).toBe(1);
  });
});
