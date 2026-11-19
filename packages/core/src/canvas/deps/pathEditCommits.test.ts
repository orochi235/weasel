import { describe, expect, it } from 'vitest';
import { polygonFromPoints, type PolygonPath } from '@weasel-js/geom';
import { IDENTITY_POSE_COMPOSITION } from 'core/scene/composeFrame';
import { createScene } from 'core/scene/scene';
import { createSetPoseOp } from 'core/ops/setPose';
import { defaultCommitAdapter } from 'interactions/actions/defaultCommitAdapter';
import type { Scene } from 'core/scene/types';
import type { PathEditExtension, PathTransformFinishCtx } from 'domains/paths/pathEditExtension';
import { createTransformPreview, transformOps } from './pathEditCommits';

const poly = (...pts: [number, number][]) => polygonFromPoints(pts.map(([x, y]) => ({ x, y }))) as PolygonPath;

function setup() {
  const scene = createScene<Record<string, unknown>, 'main', unknown>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] });
  const a = scene.add({ kind: 'mark', layer: 'main', pose: poly([0, 0], [10, 0], [10, 10]), data: {} });
  const b = scene.add({ kind: 'mark', layer: 'main', pose: poly([20, 0], [30, 0], [30, 10]), data: {} });
  return { scene: scene as unknown as Scene<unknown, string, unknown>, a, b };
}

describe('transformOps', () => {
  it('shows each extension the nodes as the transform leaves them, and commits what it changes beside them', () => {
    const { scene, a, b } = setup();
    const seen: { ids: readonly string[]; after: PolygonPath | null; before: PolygonPath | null }[] = [];
    const ext: PathEditExtension = {
      id: 'follow',
      finishTransform(ctx: PathTransformFinishCtx) {
        seen.push({ ids: ctx.ids, after: ctx.path(a), before: ctx.before(a) });
        return [{ id: b, data: { followed: true } }, { id: a, data: { ignored: true } }];
      },
    };
    const moved = poly([5, 5], [15, 5], [15, 15]);
    const op = createSetPoseOp({ id: a, from: scene.get(a)!.pose, to: moved, label: 'Move' });
    const ops = transformOps(scene, [ext], [op], 'Move')!;
    expect(seen).toHaveLength(1);
    expect(seen[0].ids).toEqual([a]);
    expect(seen[0].after).toBe(moved);
    expect(seen[0].before).toBe(scene.get(a)!.pose);
    scene.applyBatch(ops, 'Move', defaultCommitAdapter(scene));
    expect(scene.get(a)!.pose).toBe(moved);
    expect(scene.get(a)!.data).toEqual({});
    expect(scene.get(b)!.data).toEqual({ followed: true });
    scene.undo();
    expect(scene.get(b)!.data).toEqual({});
    expect(scene.get(a)!.pose).not.toBe(moved);
  });

  it('answers null when an extension refuses, and the batch as it is with no extension finishing transforms', () => {
    const { scene, a } = setup();
    const op = createSetPoseOp({ id: a, from: scene.get(a)!.pose, to: poly([1, 1], [2, 1], [2, 2]), label: 'Move' });
    expect(transformOps(scene, [{ id: 'no', finishTransform: () => null }], [op], 'Move')).toBeNull();
    expect(transformOps(scene, [{ id: 'none' }], [op], 'Move')).toEqual([op]);
  });
});

describe('createTransformPreview', () => {
  it('previews each other node as transformOps commits it, data and all', () => {
    const { scene, a, b } = setup();
    const c = scene.add({ kind: 'mark', layer: 'main', pose: poly([40, 0], [50, 0], [50, 10]), data: { kept: 1 } } as never);
    const moved = poly([5, 5], [15, 5], [15, 15]);
    const cPath = poly([41, 1], [51, 1], [51, 11]);
    const ext: PathEditExtension = {
      id: 'follow',
      finishTransform: () => [{ id: b, data: { followed: true } }, { id: c, path: cPath, data: { renumbered: true } }],
    };
    const preview = createTransformPreview(scene, [ext], new Map([[a, moved]]));
    const op = createSetPoseOp({ id: a, from: scene.get(a)!.pose, to: moved, label: 'Move' });
    scene.applyBatch(transformOps(scene, [ext], [op], 'Move')!, 'Move', defaultCommitAdapter(scene));
    const byId = new Map(preview.map((n) => [n.id, n]));
    expect(byId.get(b)).toEqual({ id: b, pose: scene.get(b)!.pose, data: scene.get(b)!.data });
    expect(byId.get(c)).toEqual({ id: c, pose: scene.get(c)!.pose, data: scene.get(c)!.data });
    expect(scene.get(c)!.data).toEqual({ kept: 1, renumbered: true });
  });
});
