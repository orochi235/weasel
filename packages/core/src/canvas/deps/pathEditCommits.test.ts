import { describe, expect, it } from 'vitest';
import { polygonFromPoints, type PolygonPath } from '@weasel-js/geom';
import { createScene } from 'core/scene/scene';
import { createTransformOp } from 'core/ops/transform';
import { defaultCommitAdapter } from 'interactions/actions/defaultCommitAdapter';
import type { Scene } from 'core/scene/types';
import type { PathEditExtension, PathTransformFinishCtx } from 'domains/paths/pathEditExtension';
import { transformOps } from './pathEditCommits';

const poly = (...pts: [number, number][]) => polygonFromPoints(pts.map(([x, y]) => ({ x, y }))) as PolygonPath;

function setup() {
  const scene = createScene<Record<string, unknown>, 'main', unknown>({ systemLayers: [{ id: 'main' }] });
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
    const op = createTransformOp({ id: a, from: scene.get(a)!.pose, to: moved, label: 'Move' });
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
    const op = createTransformOp({ id: a, from: scene.get(a)!.pose, to: poly([1, 1], [2, 1], [2, 2]), label: 'Move' });
    expect(transformOps(scene, [{ id: 'no', finishTransform: () => null }], [op], 'Move')).toBeNull();
    expect(transformOps(scene, [{ id: 'none' }], [op], 'Move')).toEqual([op]);
  });
});
