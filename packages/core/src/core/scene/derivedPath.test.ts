/**
 * What `resolveDerivedPath` notices on its own, with no invalidation pushed at
 * it.
 *
 * The scene pushes invalidation for the edits it performs, but a lookup is
 * free to answer poses the scene never wrote — `sceneDepLookup(scene, toPose)`
 * is the one in the tree — and nothing drops a memo slot for those. Each case
 * here moves a dependency behind the scene's back and asks for the path again.
 */
import { describe, it, expect } from 'vitest';
import { resolveDerivedPath } from './derivedPath';
import { PATH_L, PATH_M, type Path, type PolygonPath } from '../geometry/path';
import type { DerivedDep, Node, NodeId, RectPose } from './types';

const box = (x: number, y: number, w = 10, h = 10): RectPose => ({ x, y, width: w, height: h });

const segment = (from: RectPose, to: RectPose): PolygonPath => ({
  kind: 'polygon',
  commands: new Uint8Array([PATH_M, PATH_L]),
  coords: new Float32Array([from.x, from.y, to.x, to.y]),
  fillRule: 'nonzero',
});

const coordsOf = (path: Path | null): number[] =>
  path === null ? [] : [...(path as { coords: Float32Array }).coords];

const noChildren = (): readonly NodeId[] => [];

/**
 * An edge between `a` and `b`, read through a lookup backed by a mutable map —
 * a stand-in for any `depOf` answering poses of its own. `routes` counts the
 * calls `derivePath` actually made.
 */
function edgeOver(poses: Map<string, RectPose>) {
  const routes = { count: 0 };
  const node = {
    id: 'edge' as NodeId,
    pose: box(0, 0, 0, 0),
    data: {},
    dependsOn: ['a', 'b'] as NodeId[],
    derivePath: (_n: never, deps: readonly (DerivedDep<RectPose> | undefined)[]): Path | null => {
      routes.count++;
      const [from, to] = deps;
      if (from === undefined || to === undefined) return null;
      return segment(from.pose, to.pose);
    },
  };
  // The scene's own lookups answer a stable node object per id; a fresh one
  // per call would read as a node swapped for another.
  const nodes = new Map<string, object>();
  const depOf = (id: NodeId): DerivedDep<RectPose> | undefined => {
    const pose = poses.get(id);
    if (pose === undefined) return undefined;
    let dep = nodes.get(id);
    if (dep === undefined) { dep = { id }; nodes.set(id, dep); }
    return {
      node: dep as unknown as Node<unknown, string, RectPose>,
      pose,
      get path(): Path | null { return null; },
    };
  };
  const resolve = (): Path | null => resolveDerivedPath(node, depOf, noChildren);
  return { node, resolve, routes };
}

describe('resolveDerivedPath — value comparison of the resolved poses', () => {
  it('serves the memo when every dependency resolves to the same pose', () => {
    const poses = new Map([['a', box(0, 0)], ['b', box(100, 0)]]);
    const { resolve, routes } = edgeOver(poses);
    expect(coordsOf(resolve())).toEqual([0, 0, 100, 0]);
    expect(coordsOf(resolve())).toEqual([0, 0, 100, 0]);
    expect(routes.count).toBe(1);
  });

  // Miss 1 — an ancestor moving. A lookup that composes a parent transform
  // answers a new pose for a node the scene never touched, so no op ran and
  // nothing dropped the slot.
  it('re-routes when a dependency resolves to a moved pose', () => {
    const poses = new Map([['a', box(0, 0)], ['b', box(100, 0)]]);
    const { resolve, routes } = edgeOver(poses);
    resolve();

    poses.set('a', box(50, 20));
    expect(coordsOf(resolve())).toEqual([50, 20, 100, 0]);
    expect(routes.count).toBe(2);
  });

  // Miss 2 — a removal. The dependency stops resolving, and the cached path
  // still meets a node that is no longer there.
  it('re-routes when a dependency stops resolving', () => {
    const poses = new Map([['a', box(0, 0)], ['b', box(100, 0)]]);
    const { resolve, routes } = edgeOver(poses);
    resolve();

    poses.delete('a');
    expect(resolve()).toBeNull();
    expect(routes.count).toBe(2);
  });

  // Miss 3 — a dependency appearing. `derivePath` answered `null` against an
  // absent dependency, and that `null` is a real cached answer.
  it('re-routes when an absent dependency appears', () => {
    const poses = new Map([['b', box(100, 0)]]);
    const { resolve, routes } = edgeOver(poses);
    expect(resolve()).toBeNull();

    poses.set('a', box(0, 0));
    expect(coordsOf(resolve())).toEqual([0, 0, 100, 0]);
    expect(routes.count).toBe(2);
  });

  // The distinction the seam turns on: an override mutates its pose buffer in
  // place, so the reference a reference-compare would look at never changes.
  it('re-routes when a dependency pose is mutated in place', () => {
    const moving = box(0, 0);
    const poses = new Map([['a', moving], ['b', box(100, 0)]]);
    const { resolve, routes } = edgeOver(poses);
    resolve();

    moving.x = 50;
    expect(coordsOf(resolve())).toEqual([50, 0, 100, 0]);
    expect(routes.count).toBe(2);
  });

  // A pose object swapped for an equal one is not a move. Reference equality
  // would re-route here; value equality is what keeps the frame a memo hit.
  it('serves the memo when a pose is replaced by an equal value', () => {
    const poses = new Map([['a', box(0, 0)], ['b', box(100, 0)]]);
    const { resolve, routes } = edgeOver(poses);
    resolve();

    poses.set('a', box(0, 0));
    expect(coordsOf(resolve())).toEqual([0, 0, 100, 0]);
    expect(routes.count).toBe(1);
  });

  it('re-routes when a dependency is replaced by a different node at the same pose', () => {
    const poses = new Map([['a', box(0, 0)], ['b', box(100, 0)]]);
    const routes = { count: 0 };
    let aNode = { id: 'a' as NodeId, data: { weight: 1 } };
    const bNode = { id: 'b' as NodeId, data: {} };
    const node = {
      id: 'edge' as NodeId,
      pose: box(0, 0, 0, 0),
      data: {},
      dependsOn: ['a', 'b'] as NodeId[],
      derivePath: (_n: never, deps: readonly (DerivedDep<RectPose> | undefined)[]): Path | null => {
        routes.count++;
        const [from, to] = deps;
        return from === undefined || to === undefined ? null : segment(from.pose, to.pose);
      },
    };
    const depOf = (id: NodeId): DerivedDep<RectPose> | undefined => {
      const pose = poses.get(id);
      if (pose === undefined) return undefined;
      const n = id === 'a' ? aNode : bNode;
      return {
        node: n as unknown as Node<unknown, string, RectPose>,
        pose,
        get path(): Path | null { return null; },
      };
    };
    resolveDerivedPath(node, depOf, noChildren);
    expect(routes.count).toBe(1);

    // What `kit:remove`'s revert does: the restored node is a clone, so the
    // derivation is reading a different object even where the pose matches.
    aNode = { id: 'a' as NodeId, data: { weight: 2 } };
    resolveDerivedPath(node, depOf, noChildren);
    expect(routes.count).toBe(2);
  });
});
