import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createScene, derivedDepOf, type NodeId, type RectPose, type Vec2 } from '@weasel-js/core';
import { EDGE_DERIVE_PATH } from './edge';
import { GROUP_DERIVE_POSE, boxAround } from './group';
import { useLiveLayout } from './live';
import { sceneParticipants } from './portLayer';

const LAYERS = [{ id: 'main' as const }];
const box = (x: number, y: number, w = 40, h = 20): RectPose => ({ x, y, width: w, height: h });
type S = ReturnType<typeof createScene<object, 'main', RectPose>>;

function makeClock() {
  let next = 1;
  const callbacks = new Map<number, (t: number) => void>();
  return {
    requestFrame: (cb: (t: number) => void): number => { const h = next++; callbacks.set(h, cb); return h; },
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

function live(s: S, algorithm: string) {
  const clock = makeClock();
  const { result } = renderHook(() => useLiveLayout<RectPose>({
    scene: s,
    source: sceneParticipants<RectPose>(s as never),
    algorithm,
    frames: 4,
    requestFrame: clock.requestFrame,
    cancelFrame: clock.cancelFrame,
  }));
  return { clock, handle: () => result.current };
}

const edgeData = (extra: object = {}) => ({ diagram: { from: {}, to: {}, router: 'straight', ...extra } });

function addEdge(s: S, from: NodeId, to: NodeId, extra: object = {}): NodeId {
  return s.add({
    kind: 'leaf', layer: 'main', pose: box(0, 0, 0, 0),
    data: edgeData(extra), dependsOn: [from, to], derivePath: EDGE_DERIVE_PATH as never,
  });
}

/** The points of the path the scene draws for `edge` this frame. */
function drawn(s: S, edge: NodeId): Vec2[] {
  const node = s.get(edge)!;
  const path = s.overrides.read(edge)?.path
    ?? node.derivePath!(node as never, (node.dependsOn as NodeId[]).map((d) => derivedDepOf(s, d)) as never);
  const coords = Array.from((path as { coords: Float32Array }).coords);
  return coords.flatMap((x, i) => (i % 2 === 0 ? [{ x, y: coords[i + 1]! }] : []));
}

/** Where the scene draws `id` this frame. */
const shownAt = (s: S, id: NodeId): RectPose => derivedDepOf(s, id)!.pose;
const centerOf = (r: RectPose): Vec2 => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
const close = (a: Vec2, b: Vec2) => Math.abs(a.x - b.x) < 1e-3 && Math.abs(a.y - b.y) < 1e-3;

describe('a live run\'s eased routes', () => {
  it('leave by the face the run will commit, not the one the document holds', () => {
    const s = createScene<object, 'main', RectPose>({ systemLayers: LAYERS });
    const a = s.add({ kind: 'leaf', layer: 'main', pose: box(0, 0), data: { diagram: {} } });
    const b = s.add({ kind: 'leaf', layer: 'main', pose: box(200, 30), data: { diagram: {} } });
    // Laid out left to right by an earlier run.
    const e = addEdge(s, a, b, { from: { port: 'e', laidOut: 'e' }, to: { port: 'w', laidOut: 'w' } });
    const { clock, handle } = live(s, 'layered');
    act(() => { handle().start(); });
    act(() => { clock.frames(3); });
    const at = shownAt(s, a);
    // Downward layered leaves `a` by its south face.
    expect(drawn(s, e)[0]).toEqual({ x: at.x + at.width / 2, y: at.y + at.height });
    act(() => { clock.frames(1); });
    expect((s.get(e)!.data as { diagram: { from: { port?: string } } }).diagram.from.port).toBe('s');
  });

  it('meet a group\'s box where its members are drawn this frame', () => {
    const s = createScene<object, 'main', RectPose>({ systemLayers: LAYERS });
    const a = s.add({ kind: 'leaf', layer: 'main', pose: box(0, 0), data: { diagram: {} } });
    const b = s.add({ kind: 'leaf', layer: 'main', pose: box(300, 10), data: { diagram: {} } });
    const c = s.add({ kind: 'leaf', layer: 'main', pose: box(260, 200), data: { diagram: {} } });
    const g = s.add({
      kind: 'leaf', layer: 'main', pose: box(0, 0, 0, 0),
      data: { diagram: { group: { inset: 12 } } }, dependsOn: [b, c], derivePose: GROUP_DERIVE_POSE as never,
    });
    const e = addEdge(s, a, g);
    const { clock, handle } = live(s, 'layered');
    act(() => { handle().start(); });
    for (let f = 0; f < 3; f++) {
      act(() => { clock.frames(1); });
      const [pb, pc] = [shownAt(s, b), shownAt(s, c)];
      const x0 = Math.min(pb.x, pc.x);
      const y0 = Math.min(pb.y, pc.y);
      const union = { x: x0, y: y0, width: Math.max(pb.x + pb.width, pc.x + pc.width) - x0, height: Math.max(pb.y + pb.height, pc.y + pc.height) - y0 };
      const g1 = boxAround(union, { inset: 12 });
      // Downward layered arrives at the group by its north face.
      expect(drawn(s, e).at(-1)).toEqual({ x: g1.x + g1.width / 2, y: g1.y });
    }
  });

  it('ease a laid-out bend out of a force run', () => {
    const s = createScene<object, 'main', RectPose>({ systemLayers: LAYERS });
    const a = s.add({ kind: 'leaf', layer: 'main', pose: box(0, 0), data: { diagram: {} } });
    const b = s.add({ kind: 'leaf', layer: 'main', pose: box(200, 30), data: { diagram: {} } });
    const c = s.add({ kind: 'leaf', layer: 'main', pose: box(60, 180), data: { diagram: {} } });
    addEdge(s, a, b);
    addEdge(s, b, c);
    const long = addEdge(s, a, c);
    const route = () => (s.get(long)!.data as { diagram: { waypoints?: Vec2[] } }).diagram.waypoints ?? [];
    const first = live(s, 'layered');
    act(() => { first.handle().start(); });
    act(() => { first.clock.frames(4); });
    const was = route();
    expect(was).toHaveLength(2);

    const { clock, handle } = live(s, 'force');
    act(() => { handle().start(); });
    // Two frames of four, eased in and out: halfway to the straight line
    // between the ends as this frame draws them.
    act(() => { clock.frames(2); });
    const [ca, cc] = [centerOf(shownAt(s, a)), centerOf(shownAt(s, c))];
    const points = drawn(s, long);
    for (const [k, p] of was.entries()) {
      const t = (k + 1) / (was.length + 1);
      const straight = { x: ca.x + (cc.x - ca.x) * t, y: ca.y + (cc.y - ca.y) * t };
      expect(points.some((q) => close(q, { x: (p.x + straight.x) / 2, y: (p.y + straight.y) / 2 }))).toBe(true);
    }
    // Arrived: straight, while the document still holds the bends.
    act(() => { clock.frames(2); });
    expect(handle().isRunning()).toBe(true);
    expect(route()).toHaveLength(2);
    expect(drawn(s, long)).toHaveLength(2);
  });
});
