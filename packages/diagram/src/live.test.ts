import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createScene, type NodeId, type RectPose } from '@weasel-js/core';
import { buildGraph, type Graph } from './graph';
import { force } from './force';
import { easedProducer, forceProducer, useLiveLayout } from './live';
import { sceneParticipants } from './portLayer';
import { layered } from './layered';

const LAYERS = [{ id: 'main' as const }];
const box = (x: number, y: number, w = 40, h = 20): RectPose => ({ x, y, width: w, height: h });

/** Three boxes and two edges, scattered. */
function scene() {
  const s = createScene<object, 'main', RectPose>({ systemLayers: LAYERS });
  const a = s.add({ kind: 'leaf', layer: 'main', pose: box(0, 0), data: { diagram: {} } });
  const b = s.add({ kind: 'container', layer: 'main', pose: box(200, 30), data: { diagram: {} } });
  const c = s.add({ kind: 'leaf', layer: 'main', pose: box(60, 180), data: { diagram: {} } });
  const edge = (from: NodeId, to: NodeId) => s.add({
    kind: 'leaf', layer: 'main', pose: box(0, 0, 0, 0),
    data: { diagram: { from: {}, to: {} } },
    dependsOn: [from, to],
  });
  edge(a, b);
  edge(b, c);
  return { scene: s, a, b, c };
}

const graphOf = (s: ReturnType<typeof scene>['scene']): Graph =>
  buildGraph(sceneParticipants<RectPose>(s as never));

/** Manual rAF driver. */
function makeClock() {
  let next = 1;
  const callbacks = new Map<number, (t: number) => void>();
  return {
    requestFrame: (cb: (t: number) => void): number => {
      const h = next++;
      callbacks.set(h, cb);
      return h;
    },
    cancelFrame: (h: number): void => { callbacks.delete(h); },
    frames(n: number) {
      for (let i = 0; i < n; i++) {
        const due = [...callbacks.values()];
        callbacks.clear();
        for (const cb of due) cb(0);
      }
    },
  };
}

const NO_PINS: ReadonlyMap<NodeId, RectPose> = new Map();

describe('forceProducer', () => {
  it('lands where the one-shot force lands, tick for tick', () => {
    // The guard against two force lists drifting apart: they are the same
    // list, so N frames and N ticks produce the same arrangement. Only the
    // arrangement — the one-shot re-anchors its answer over the graph's old
    // bounding box and a live run does not, which is a rigid translation.
    const s = scene();
    const oneShot = force(graphOf(s.scene), { iterations: 20 });
    const producer = forceProducer<RectPose>(graphOf(s.scene));
    let frame = producer({ pinned: NO_PINS, frame: 0 });
    for (let i = 1; i < 20; i++) frame = producer({ pinned: NO_PINS, frame: i });

    const ids = [...oneShot.keys()];
    const first = ids[0]!;
    const shift = {
      x: oneShot.get(first)!.x - frame.result.get(first)!.x,
      y: oneShot.get(first)!.y - frame.result.get(first)!.y,
    };
    for (const id of ids) {
      expect(frame.result.get(id)!.x + shift.x).toBeCloseTo(oneShot.get(id)!.x, 6);
      expect(frame.result.get(id)!.y + shift.y).toBeCloseTo(oneShot.get(id)!.y, 6);
    }
  });

  it('holds a pinned node exactly where the pointer put it', () => {
    const s = scene();
    const producer = forceProducer<RectPose>(graphOf(s.scene));
    const pinned = new Map<NodeId, RectPose>([[s.a, box(500, 500)]]);
    let frame = producer({ pinned, frame: 0 });
    for (let i = 1; i < 10; i++) frame = producer({ pinned, frame: i });
    expect(frame.result.get(s.a)).toEqual({ x: 500, y: 500 });
  });

  it('lets a released node move again', () => {
    const s = scene();
    const producer = forceProducer<RectPose>(graphOf(s.scene));
    const pinned = new Map<NodeId, RectPose>([[s.a, box(500, 500)]]);
    for (let i = 0; i < 5; i++) producer({ pinned, frame: i });
    let frame = producer({ pinned: NO_PINS, frame: 5 });
    for (let i = 6; i < 12; i++) frame = producer({ pinned: NO_PINS, frame: i });
    expect(frame.result.get(s.a)).not.toEqual({ x: 500, y: 500 });
  });

  it('keeps running while something is held, however long', () => {
    const s = scene();
    const producer = forceProducer<RectPose>(graphOf(s.scene));
    const pinned = new Map<NodeId, RectPose>([[s.a, box(500, 500)]]);
    let frame = producer({ pinned, frame: 0 });
    for (let i = 1; i < 400; i++) frame = producer({ pinned, frame: i });
    expect(frame.done).toBe(false);
  });
});

describe('easedProducer', () => {
  it('starts where the nodes are and arrives at the layout', () => {
    const s = scene();
    const graph = graphOf(s.scene);
    const target = layered(graph);
    const producer = easedProducer<RectPose>(graph, layered, { frames: 8 });

    const first = producer({ pinned: NO_PINS, frame: 0 });
    // The first frame has barely left the start — nearer where it was than
    // where it is going.
    const startedAt = 200;
    const goingTo = target.get(s.b)!.x;
    expect(Math.abs(first.result.get(s.b)!.x - startedAt))
      .toBeLessThan(Math.abs(goingTo - startedAt) / 4);
    expect(first.done).toBe(false);

    let last = first;
    for (let i = 1; i < 8; i++) last = producer({ pinned: NO_PINS, frame: i });
    expect(last.done).toBe(true);
    for (const [id, at] of target) {
      expect(last.result.get(id)!.x).toBeCloseTo(at.x, 6);
      expect(last.result.get(id)!.y).toBeCloseTo(at.y, 6);
    }
  });

  it('leaves a pinned node out of the frame entirely', () => {
    const s = scene();
    const graph = graphOf(s.scene);
    const producer = easedProducer<RectPose>(graph, layered, { frames: 4 });
    const frame = producer({ pinned: new Map([[s.a, box(9, 9)]]), frame: 2 });
    expect(frame.result.has(s.a)).toBe(false);
  });
});

describe('useLiveLayout', () => {
  function live(algorithm: string) {
    const s = scene();
    const clock = makeClock();
    const { result } = renderHook(() => useLiveLayout<RectPose>({
      scene: s.scene,
      source: sceneParticipants<RectPose>(s.scene as never),
      algorithm,
      frames: 4,
      requestFrame: clock.requestFrame,
      cancelFrame: clock.cancelFrame,
    }));
    return { ...s, clock, handle: () => result.current };
  }

  it('shows frames without writing, then commits one entry', () => {
    const { scene: s, b, clock, handle } = live('layered');
    const before = s.get(b)!.pose;
    act(() => { handle().start(); });
    act(() => { clock.frames(2); });
    expect(s.get(b)!.pose).toEqual(before);
    expect(s.overrides.ids().length).toBeGreaterThan(0);

    act(() => { clock.frames(2); });
    expect(handle().isRunning()).toBe(false);
    expect(s.get(b)!.pose).not.toEqual(before);
    expect(s.overrides.ids()).toEqual([]);
    expect(s.historyEntries().at(-1)?.label).toBe('Layout');
  });

  it('leaves the document alone when canceled', () => {
    const { scene: s, b, clock, handle } = live('layered');
    const before = s.get(b)!.pose;
    act(() => { handle().start(); });
    act(() => { clock.frames(2); });
    act(() => { handle().cancel(); });
    expect(s.get(b)!.pose).toEqual(before);
    expect(s.overrides.ids()).toEqual([]);
  });

  it('takes a pinned box out of the frame with its whole subtree', () => {
    // The defect this guards: the run skips the pinned participant but its
    // label is an id of its own, so the label was published from the pose the
    // document still held and slid out of the box the gesture was carrying.
    const { scene: s, b, clock, handle } = live('layered');
    const label = s.add({
      kind: 'leaf', layer: 'main', parent: b, pose: box(204, 34, 10, 6), data: {},
    });
    act(() => { handle().start(); });
    act(() => { clock.frames(1); });
    expect(s.overrides.ids()).toContain(label);

    // Somebody grabs the box.
    act(() => { s.overrides.set(b, { pose: box(300, 300) }); });
    act(() => { clock.frames(1); });
    expect(s.overrides.ids()).not.toContain(label);
    expect(s.overrides.ids()).not.toContain(b);
  });

  it('re-heats when the graph gains a node mid-run', () => {
    const { scene: s, clock, handle } = live('layered');
    act(() => { handle().start(); });
    act(() => { clock.frames(3); });
    act(() => {
      s.add({ kind: 'leaf', layer: 'main', pose: box(400, 400), data: { diagram: {} } });
    });
    // Without the re-heat the run would have finished on frame 4.
    act(() => { clock.frames(1); });
    expect(handle().isRunning()).toBe(true);
  });
});
