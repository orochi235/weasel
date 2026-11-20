/** A swap drop: held still over a node of its shape for the dwell, a dragged node trades places with it on release. */
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import type { BindingOptions, InvocationCtx, OngoingHandle, OngoingInvoker } from '@weasel-js/routing';
import { createScene, asNodeId, type NodeId, type RectPose } from '@weasel-js/core/engine';
import type { MoveBehavior } from '@weasel-js/core/engine';
import { moveAction } from './action';
import { swapOnDrop } from './behaviors/swapOnDrop';

const A = asNodeId('a');
const B = asNodeId('b');
const C = asNodeId('c');
const MODS = { alt: false, ctrl: false, meta: false, shift: false };
const box = (x: number, y: number, w = 10, h = 10): RectPose => ({ x, y, width: w, height: h });

function setup(selected: NodeId[] = [A]) {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: A, kind: 'mark', layer: 'main', data: {}, pose: box(0, 0) });
  scene.add({ id: B, kind: 'mark', layer: 'main', data: {}, pose: box(50, 0) });
  scene.add({ id: C, kind: 'mark', layer: 'main', data: {}, pose: box(100, 0, 30, 30) });
  // Hit-tests the document, front to back, as the canvas's dep would.
  const nodeAtPoint = (p: { x: number; y: number }, exclude?: Iterable<NodeId>) => {
    const out = new Set(exclude ?? []);
    for (const id of [...scene.roots].reverse()) {
      const pose = scene.get(id)!.pose;
      if (!out.has(id) && p.x >= pose.x && p.x <= pose.x + pose.width && p.y >= pose.y && p.y <= pose.y + pose.height) return id;
    }
    return null;
  };
  const deps = { operands: { get: () => selected }, scene, nodeAtPoint };
  const at = (x: number, y: number) => ({
    world: { x, y }, screen: { x, y }, modifiers: MODS, deps,
    drag: { start: { x: 5, y: 5 }, current: { x, y }, delta: { x: x - 5, y: y - 5 } },
  }) as unknown as InvocationCtx;
  const start = (opts: BindingOptions) => (moveAction.invoker as OngoingInvoker).start(
    { world: { x: 5, y: 5 }, screen: { x: 5, y: 5 }, modifiers: MODS, deps } as unknown as InvocationCtx, opts,
  ) as OngoingHandle;
  return { scene, at, start };
}

const DWELL: BindingOptions = { params: { swapOnDrop: 'dwell' } };

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('moveAction with swapOnDrop: dwell', () => {
  it('passing over a node moves as usual', () => {
    const { scene, at, start } = setup();
    const h = start(DWELL);
    h.onMove!(at(55, 5));
    vi.advanceTimersByTime(900);
    h.onEnd!(at(55, 5), 'commit');
    expect(scene.get(A)!.pose).toEqual(box(50, 0));
    expect(scene.get(B)!.pose).toEqual(box(50, 0));
    expect(scene.historyEntries().at(-1)?.label).toBe('Move');
  });

  it('held still for the dwell, previews the swap, outlines the target and shows the swap cursor', () => {
    const { scene, at, start } = setup();
    const h = start(DWELL);
    const changed = vi.fn();
    h.subscribe?.(changed);
    h.onMove!(at(55, 5));
    expect(h.cursor?.()).toBeUndefined();
    vi.advanceTimersByTime(1000);
    expect(changed).toHaveBeenCalled();
    expect(scene.overrides.read(B)?.pose).toEqual(box(0, 0));
    expect(h.cursor?.()).toEqual({ glyph: 'swap', fallback: 'move' });
    expect(h.overlay?.()).toEqual([expect.objectContaining({ kind: 'polyline', role: 'target' })]);
  });

  it('released armed, trades the two places in one undo step labeled Swap', () => {
    const { scene, at, start } = setup();
    const before = scene.historyEntries().length;
    const h = start(DWELL);
    h.onMove!(at(55, 5));
    vi.advanceTimersByTime(1000);
    h.onMove!(at(57, 6));
    h.onEnd!(at(57, 6), 'commit');
    expect(scene.get(A)!.pose).toEqual(box(50, 0));
    expect(scene.get(B)!.pose).toEqual(box(0, 0));
    expect(scene.roots).toEqual([B, A, C]);
    expect(scene.historyEntries().length).toBe(before + 1);
    expect(scene.historyEntries().at(-1)?.label).toBe('Swap');
    scene.undo();
    expect(scene.get(A)!.pose).toEqual(box(0, 0));
    expect(scene.get(B)!.pose).toEqual(box(50, 0));
    expect(scene.roots).toEqual([A, B, C]);
  });

  it('moving off disarms it, and coming back starts the wait again', () => {
    const { scene, at, start } = setup();
    const h = start(DWELL);
    h.onMove!(at(55, 5));
    vi.advanceTimersByTime(1000);
    h.onMove!(at(35, 5));
    expect(h.cursor?.()).toBeUndefined();
    expect(scene.overrides.read(B)).toBeUndefined();
    h.onMove!(at(55, 5));
    vi.advanceTimersByTime(600);
    expect(h.cursor?.()).toBeUndefined();
    vi.advanceTimersByTime(400);
    expect(h.cursor?.()).toEqual({ glyph: 'swap', fallback: 'move' });
  });

  it('never arms over a node of another size', () => {
    const { scene, at, start } = setup();
    const h = start(DWELL);
    h.onMove!(at(110, 10));
    vi.advanceTimersByTime(2000);
    expect(h.cursor?.()).toBeUndefined();
    h.onEnd!(at(110, 10), 'commit');
    expect(scene.get(C)!.pose).toEqual(box(100, 0, 30, 30));
  });

  it('never swaps a drag of several nodes', () => {
    const { scene, at, start } = setup([A, C]);
    const h = start(DWELL);
    h.onMove!(at(55, 5));
    vi.advanceTimersByTime(2000);
    h.onEnd!(at(55, 5), 'commit');
    expect(scene.get(B)!.pose).toEqual(box(50, 0));
    expect(scene.historyEntries().at(-1)?.label).toBe('Move');
  });

  it('is off by default', () => {
    const { scene, at, start } = setup();
    const h = start({});
    h.onMove!(at(55, 5));
    vi.advanceTimersByTime(2000);
    h.onEnd!(at(55, 5), 'commit');
    expect(scene.get(B)!.pose).toEqual(box(50, 0));
  });

  it('canceled while armed, changes nothing', () => {
    const { scene, at, start } = setup();
    const before = scene.historyEntries().length;
    const h = start(DWELL);
    h.onMove!(at(55, 5));
    vi.advanceTimersByTime(1000);
    h.onEnd!(at(55, 5), 'cancel');
    expect(scene.get(A)!.pose).toEqual(box(0, 0));
    expect(scene.get(B)!.pose).toEqual(box(50, 0));
    expect(scene.historyEntries().length).toBe(before);
  });

  it('asks the canSwap dep', () => {
    const { scene, at } = setup();
    const h = (moveAction.invoker as OngoingInvoker).start({
      world: { x: 5, y: 5 }, screen: { x: 5, y: 5 }, modifiers: MODS,
      deps: { operands: { get: () => [A] }, scene, nodeAtPoint: () => B, canSwap: () => false },
    } as unknown as InvocationCtx, DWELL) as OngoingHandle;
    h.onMove!(at(55, 5));
    vi.advanceTimersByTime(2000);
    expect(h.cursor?.()).toBeUndefined();
  });
});

describe('swapOnDrop in a binding’s behaviors', () => {
  it('swaps with the node its targetAt names, after its own dwell', () => {
    const { scene, at, start } = setup();
    const targetAt = vi.fn(() => B as string);
    const h = start({ behaviors: [swapOnDrop({ dwellMs: 200, targetAt }) as MoveBehavior<unknown>] } as BindingOptions);
    h.onMove!(at(200, 200));
    vi.advanceTimersByTime(200);
    h.onEnd!(at(200, 200), 'commit');
    expect(targetAt).toHaveBeenCalledWith({ x: 200, y: 200 }, A);
    expect(scene.get(A)!.pose).toEqual(box(50, 0));
    expect(scene.get(B)!.pose).toEqual(box(0, 0));
  });
});
