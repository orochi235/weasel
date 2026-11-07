/**
 * Align and distribute translate their members the way a move does: a node
 * whose pose derives from others moves through what it derives from, and
 * data-held geometry moves with the pose.
 */
import { describe, expect, it } from 'vitest';
import type { ImmediateInvoker } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { effectivePose } from 'core/scene/effectivePose';
import type { DerivedDep, NodeId, RectPose } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { GeometryProjection } from '../geometryProjection';
import { stubDeps } from '../testUtils';
import { alignLeftAction } from './action';
import { distributeHorizontalAction } from '../distribute/action';

interface Data { pts?: { x: number; y: number }[] }

const box = (x: number, y: number, w = 10, h = 10): RectPose => ({ x, y, width: w, height: h });

const around = (_n: unknown, deps: readonly (DerivedDep<RectPose> | undefined)[]): RectPose | null => {
  const ps = deps.filter((d) => d !== undefined).map((d) => d.pose);
  if (ps.length === 0) return null;
  const x = Math.min(...ps.map((p) => p.x));
  const y = Math.min(...ps.map((p) => p.y));
  return box(x, y, Math.max(...ps.map((p) => p.x + p.width)) - x, Math.max(...ps.map((p) => p.y + p.height)) - y);
};

/** Points held in data, translated by the pose's affine. */
const POINTS: GeometryProjection = {
  transform: (node, m) => {
    const pts = (node.data as Data).pts;
    if (!pts) return null;
    return { pts: pts.map((p) => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] })) };
  },
};

function scene() {
  return createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
}

function run(action: typeof alignLeftAction, s: ReturnType<typeof scene>, ids: NodeId[], extra = {}) {
  const selection = { get: () => ids } as unknown as SelectionApi;
  (action.invoker as ImmediateInvoker).run(stubDeps({ scene: s, selection, ...extra }));
}

describe('align and distribute over derived and data-held geometry', () => {
  it('align moves what a derived node derives from', () => {
    const s = scene();
    const a = s.add({ kind: 'mark', layer: 'main', data: {}, pose: box(100, 0) });
    const b = s.add({ kind: 'mark', layer: 'main', data: {}, pose: box(150, 0) });
    const derived = s.add({ kind: 'mark', layer: 'main', data: {}, pose: box(0, 0), dependsOn: [a, b], derivePose: around as never });
    const free = s.add({ kind: 'mark', layer: 'main', data: {}, pose: box(0, 50) });
    run(alignLeftAction, s, [derived, free]);
    expect(effectivePose(s, s.get(a)!)).toEqual(box(0, 0));
    expect(effectivePose(s, s.get(b)!)).toEqual(box(50, 0));
    expect(effectivePose(s, s.get(derived)!)).toEqual(box(0, 0, 60, 10));
  });

  it('align carries data-held geometry with the pose', () => {
    const s = scene();
    const a = s.add({ kind: 'mark', layer: 'main', data: { pts: [{ x: 100, y: 0 }] }, pose: box(100, 0) });
    const b = s.add({ kind: 'mark', layer: 'main', data: {}, pose: box(0, 50) });
    run(alignLeftAction, s, [a, b], { geometryProjection: POINTS });
    expect(s.get(a)!.pose).toEqual(box(0, 0));
    expect(s.get(a)!.data.pts).toEqual([{ x: 0, y: 0 }]);
  });

  it('distribute carries data-held geometry with the pose, as one undo step', () => {
    const s = scene();
    const a = s.add({ kind: 'mark', layer: 'main', data: {}, pose: box(0, 0) });
    const b = s.add({ kind: 'mark', layer: 'main', data: { pts: [{ x: 20, y: 0 }] }, pose: box(20, 0) });
    const c = s.add({ kind: 'mark', layer: 'main', data: {}, pose: box(100, 0) });
    run(distributeHorizontalAction, s, [a, b, c], { geometryProjection: POINTS });
    expect(s.get(b)!.pose).toEqual(box(50, 0));
    expect(s.get(b)!.data.pts).toEqual([{ x: 50, y: 0 }]);
    s.undo();
    expect(s.get(b)!.pose).toEqual(box(20, 0));
    expect(s.get(b)!.data.pts).toEqual([{ x: 20, y: 0 }]);
  });
});
