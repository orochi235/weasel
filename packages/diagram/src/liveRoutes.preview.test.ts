/**
 * An edge whose route a live run publishes while one of its ends is dragged
 * and the drag's preview reroutes it (`publishPreviews`): the run's path, the
 * drag's pose and the preview's data each show, so what derives from the edge
 * follows the preview every frame.
 */
import { describe, expect, it } from 'vitest';
import {
  createScene, effectivePose, nodeAsShown, pathFromD, publishPreviews,
  type DerivedDep, type NodeId, type OngoingHandle, type RectPose, type Vec2,
} from '@weasel-js/core';
import { EDGE_DERIVE_PATH } from './edge';
import { pathHold } from './liveRoutes';

const box = (x: number, y: number, w = 40, h = 20): RectPose => ({ x, y, width: w, height: h });
const edgeData = (waypoints: Vec2[] = []) => ({ diagram: { from: {}, to: {}, router: 'straight', waypoints } });
type Edge = ReturnType<typeof edgeData>;

function fixture() {
  const s = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const a = s.add({ kind: 'mark', layer: 'main', pose: box(0, 0), data: { diagram: {} } });
  const b = s.add({ kind: 'mark', layer: 'main', pose: box(200, 0), data: { diagram: {} } });
  const edge = s.add({
    kind: 'mark', layer: 'main', pose: box(0, 0, 0, 0),
    data: edgeData(), dependsOn: [a, b], derivePath: EDGE_DERIVE_PATH as never,
  });
  // Sits on the edge's first waypoint, as a label pinned to a bend would.
  const label = s.add({
    kind: 'mark', layer: 'main', pose: box(0, 0, 4, 4), data: {}, dependsOn: [edge],
    derivePose: (_node, deps) => {
      const bend = ((deps[0] as DerivedDep<RectPose> | undefined)?.node.data as Edge | undefined)?.diagram.waypoints[0];
      return bend === undefined ? null : box(bend.x, bend.y, 4, 4);
    },
  });
  let reroute: Edge | null = null;
  const handles = new Set<OngoingHandle>();
  const preview: OngoingHandle = {
    previewIds: () => [edge],
    previewData: (id) => (id === edge ? reroute : null),
  };
  const listeners = new Set<() => void>();
  const stop = publishPreviews(s, {
    getInFlightHandles: () => handles.values(),
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  });
  const notify = () => { for (const fn of listeners) fn(); };
  return {
    s, a, edge, label, stop,
    /** One frame of the drag: its hold poses `a`, its handle reroutes the edge. */
    dragTo(drag: ReturnType<typeof s.overrides.hold>, x: number) {
      handles.add(preview);
      reroute = edgeData([{ x: x + 100, y: 60 }]);
      drag.set([[a, box(x, 0)]]);
      notify();
    },
    release(drag: ReturnType<typeof s.overrides.hold>) {
      handles.delete(preview);
      drag.drop();
      notify();
    },
  };
}

describe('an edge whose live route is published while its end is dragged', () => {
  it('shows the run\'s path and the preview\'s reroute together, and what derives from the edge follows', () => {
    const { s, a, edge, label, dragTo, release } = fixture();
    const route = pathHold(s);
    const drag = s.overrides.hold();
    for (const x of [10, 30, 50]) {
      const path = pathFromD(`M${x + 20} 10 L220 10`);
      route.show(new Map([[edge, path]]));
      dragTo(drag, x);
      expect(s.overrides.read(edge)?.path).toBe(path);
      expect(s.overrides.read(a)?.pose).toEqual(box(x, 0));
      expect((nodeAsShown(s.overrides, s.get(edge as NodeId)!).data as Edge).diagram.waypoints).toEqual([{ x: x + 100, y: 60 }]);
      expect(effectivePose(s, s.get(label)!)).toEqual(box(x + 100, 60, 4, 4));
    }
    release(drag);
    expect(s.overrides.read(edge)?.data).toBeUndefined();
    expect(s.overrides.read(edge)?.path).toBeDefined();
    route.drop();
    expect(s.overrides.has(edge)).toBe(false);
  });

  it('keeps the preview\'s reroute once the run lets go of the edge first', () => {
    const { s, edge, dragTo } = fixture();
    const route = pathHold(s);
    const drag = s.overrides.hold();
    route.show(new Map([[edge, pathFromD('M20 10 L220 10')]]));
    dragTo(drag, 10);
    route.drop();
    expect(s.overrides.read(edge)?.path).toBeUndefined();
    expect((nodeAsShown(s.overrides, s.get(edge)!).data as Edge).diagram.waypoints).toEqual([{ x: 110, y: 60 }]);
  });
});
