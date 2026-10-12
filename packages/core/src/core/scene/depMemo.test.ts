/**
 * What a derivation's memo notices about a dependency besides its pose, with
 * no invalidation pushed at it: everything here changes a dependency behind
 * the scene's back and asks again.
 */
import { describe, it, expect } from 'vitest';
import { PATH_L, PATH_M, type Path, type PolygonPath } from '@weasel-js/geom';
import { derivedPose, type PosedNode, type PoseSource } from './effectivePose';
import { resolveDerivedPath } from './derivedPath';
import type { DerivedDep, NodeId, RectPose } from './types';

const box = (x: number, y: number): RectPose => ({ x, y, width: 10, height: 10 });
const id = (s: string) => s as NodeId;

const segment = (from: RectPose, to: RectPose): PolygonPath => ({
  kind: 'polygon',
  commands: new Uint8Array([PATH_M, PATH_L]),
  coords: new Float32Array([from.x, from.y, to.x, to.y]),
  fillRule: 'nonzero',
});

type Deps = readonly (DerivedDep<RectPose> | undefined)[];
type Loose = PosedNode<RectPose> & { layer?: string };

function sourceOf(nodes: Loose[]): PoseSource<RectPose> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return { overrides: { read: () => undefined }, get: (k) => byId.get(k), childrenOf: () => [] };
}

describe('a derivation memo — what it re-checks of a dependency', () => {
  it('re-derives when a dependency is given new data', () => {
    const a: Loose = { id: id('a'), pose: box(0, 0), data: { weight: 1 } };
    const reader: Loose = {
      id: id('r'), pose: box(0, 0), data: {}, dependsOn: [id('a')],
      derivePose: (_n: never, [dep]: Deps) => box((dep!.node.data as { weight: number }).weight, 0),
    };
    const source = sourceOf([a, reader]);
    expect(derivedPose(source, reader)!.x).toBe(1);
    a.data = { weight: 7 };
    expect(derivedPose(source, reader)!.x).toBe(7);
  });

  it('re-derives when a dependency changes layer', () => {
    const a: Loose = { id: id('a'), pose: box(0, 0), data: {}, layer: 'back' };
    const reader: Loose = {
      id: id('r'), pose: box(0, 0), data: {}, dependsOn: [id('a')],
      derivePose: (_n: never, [dep]: Deps) => box(dep!.node.layer === 'front' ? 1 : 0, 0),
    };
    const source = sourceOf([a, reader]);
    expect(derivedPose(source, reader)!.x).toBe(0);
    a.layer = 'front';
    expect(derivedPose(source, reader)!.x).toBe(1);
  });

  it('re-derives a path when a dependency is given new data', () => {
    const a: Loose = { id: id('a'), pose: box(0, 0), data: { to: 5 } };
    const edge: Loose = {
      id: id('e'), pose: box(0, 0), data: {}, dependsOn: [id('a')],
      derivePath: (_n: never, [dep]: Deps) => segment(dep!.pose, box((dep!.node.data as { to: number }).to, 0)),
    };
    const source = sourceOf([a, edge]);
    const resolve = (): Path | null => resolveDerivedPath(edge, (k) => {
      const node = source.get(k);
      return node && { node: node as never, pose: node.pose, path: null };
    }, () => []);
    expect([...(resolve() as PolygonPath).coords]).toEqual([0, 0, 5, 0]);
    a.data = { to: 9 };
    expect([...(resolve() as PolygonPath).coords]).toEqual([0, 0, 9, 0]);
  });

  it('re-derives when the path it read off a dependency is redrawn', () => {
    const a: Loose = { id: id('a'), pose: box(0, 0), data: {} };
    const edge: Loose = {
      id: id('e'), pose: box(0, 0), data: {}, dependsOn: [id('a')],
      derivePath: (_n: never, [dep]: Deps) => segment(box(0, 0), dep!.pose),
    };
    const label: Loose = {
      id: id('l'), pose: box(0, 0), data: {}, dependsOn: [id('e')],
      derivePose: (_n: never, [dep]: Deps) => box((dep!.path as PolygonPath).coords[2], 0),
    };
    const source = sourceOf([a, edge, label]);
    expect(derivedPose(source, label)!.x).toBe(0);
    a.pose = box(40, 0);
    expect(derivedPose(source, label)!.x).toBe(40);
  });

  it('does not resolve a dependency path the derivation never read', () => {
    let routed = 0;
    const a: Loose = { id: id('a'), pose: box(0, 0), data: {} };
    const edge: Loose = {
      id: id('e'), pose: box(0, 0), data: {}, dependsOn: [id('a')],
      derivePath: (_n: never, [dep]: Deps) => { routed++; return segment(box(0, 0), dep!.pose); },
    };
    const beside: Loose = {
      id: id('b'), pose: box(0, 0), data: {}, dependsOn: [id('e')],
      derivePose: (_n: never, [dep]: Deps) => box(dep!.pose.x + 1, 0),
    };
    const source = sourceOf([a, edge, beside]);
    derivedPose(source, beside);
    derivedPose(source, beside);
    expect(routed).toBe(0);
  });
});
