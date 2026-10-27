/**
 * `<SceneCanvas>`'s picks ask the pick index. The point pick reads the
 * scene's painted poses itself rather than the adapter's `getWorldPose`, which
 * is only sound while the two agree for every node: the first test pins that.
 */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { rectPath, PATH_L, PATH_M, PATH_Z, type Path } from '@weasel-js/geom';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import { rectRegion, regionOf } from 'core/geometry/regionHit';
import { IDENTITY_POSE_COMPOSITION } from 'core/scene/composeFrame';
import { createScene } from 'core/scene/scene';
import { asNodeId, type Scene } from 'core/scene/types';
import { regionPickQuery } from 'canvas/deps/hitTestArea';
import { scenePaintedPoseOf } from 'canvas/derivedPath';
import { pickWalk, scenePickSource } from 'canvas/pickWalk';
import { mixedScene } from 'canvas/pickIndex/pickIndexFixture';
import { pickIndexBuildCount } from 'canvas/pickIndex/scenePickIndex';
import { sceneToAdapter } from 'canvas/sceneAdapter';
import { scenePointQuery } from './scenePointQuery';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import { useSceneSelectTool } from './useSceneSelectTool';

type AnyScene = Scene<unknown, string, unknown>;

/** `mixedScene` plus the overrides a drag leaves: a framed child moved, and a
 *  plain node shown as a path. */
function overridden(composed: boolean): AnyScene {
  const scene = mixedScene(5, composed);
  scene.overrides.set(asNodeId('frame.b'), { pose: { x: 40, y: 10, width: 30, height: 30 } });
  scene.overrides.set(asNodeId('r12'), { path: rectPath(0, 0, 70, 20) } as never);
  scene.overrides.commit();
  return scene;
}

/** A 1,000-node grid, each node a 20×20 rect 30 apart. */
function grid(): AnyScene {
  const scene = createScene<unknown, string, unknown>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] });
  for (let i = 0; i < 1000; i++) {
    scene.add({
      id: asNodeId(`n${i}`), kind: 'mark', layer: 'main', data: null,
      pose: { x: (i % 40) * 30, y: Math.floor(i / 40) * 30, width: 20, height: 20 },
    } as never);
  }
  return scene as AnyScene;
}

describe('useSceneSelectTool through the pick index', () => {
  for (const composed of [false, true]) {
    it(`the select tool's getWorldPose agrees with the index's painted pose (${composed ? 'composed' : 'absolute'})`, () => {
      const scene = overridden(composed);
      const adapter = sceneToAdapter(scene);
      const painted = scenePaintedPoseOf(scene);
      const viaAdapter = scenePickSource(scene, { getPose: (id) => adapter.getWorldPose(id) });
      const viaScene = scenePickSource(scene);
      const nodes = scene.renderOrderNodes();
      expect(nodes.some((n) => n.dependsOn !== undefined)).toBe(true);
      for (const node of nodes) {
        expect([node.id, adapter.getWorldPose(node.id)]).toEqual([node.id, painted(node)]);
        // Dropping `getPose` also changes where the source reads derived paths.
        const want = viaAdapter.derivedPathOf!(node as never);
        if (scene.overrides.read(node.id)?.path === undefined) {
          expect([node.id, viaScene.derivedPathOf!(node as never)]).toEqual([node.id, want]);
        }
      }
    });
  }

  it('hover and click pick through the index', () => {
    const scene = grid();
    const adapter = sceneToAdapter(scene);
    const { result } = renderHook(() => useSceneSelectTool({ scene, adapter }));
    const full = scenePickSource(scene, { getPose: (id) => adapter.getWorldPose(id) });
    const at = (x: number, y: number) =>
      pickWalk(full, scenePointQuery(AUTO_POSE_DESCRIPTOR, true, 4)(x, y, { x: 1, y: 1 }));

    const before = pickIndexBuildCount();
    expect(result.current.pickBest(615, 615)).toBe(at(615, 615).at(-1));
    expect(result.current.pickEvery(615, 615)).toEqual(at(615, 615));
    expect(result.current.pickEvery(10, 10)).toEqual(['n0']);
    expect(at(615, 615)).toEqual(['n820']);
    expect(pickIndexBuildCount() - before).toBe(1);
  });

  it('hover and click pick through the index under a non-default poseDescriptor', () => {
    // Each node reaches 8 past its painted right edge, into the gap before the next.
    const d: PoseDescriptor<unknown> = {
      ...AUTO_POSE_DESCRIPTOR,
      getBounds: (p) => {
        const b = AUTO_POSE_DESCRIPTOR.getBounds(p);
        return { x: b.x, y: b.y, width: b.width + 8, height: b.height };
      },
    };
    const scene = grid();
    const adapter = sceneToAdapter(scene);
    const { result } = renderHook(() => useSceneSelectTool({ scene, adapter, poseDescriptor: d, geometry: { picking: 'pose' } }));
    const full = scenePickSource(scene);
    const at = (x: number, y: number, g: PoseDescriptor<unknown>) =>
      pickWalk(full, scenePointQuery(g, false, 4)(x, y, { x: 1, y: 1 }));

    const before = pickIndexBuildCount();
    for (let i = 0; i < 2; i++) expect(result.current.pickEvery(625, 615)).toEqual(at(625, 615, d));
    expect(at(625, 615, d)).toEqual(['n820']);
    expect(at(625, 615, AUTO_POSE_DESCRIPTOR)).toEqual([]);
    expect(result.current.pickBest(625, 615)).toBe('n820');
    expect(pickIndexBuildCount() - before).toBe(1);
  });

  it('a click tests a path-overridden node against its path', () => {
    // Through `getWorldPose` the point pick read no override path for a node that derives none,
    // and took the whole pose box for a triangle.
    const scene = createScene<unknown, string, unknown>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] }) as AnyScene;
    const A = asNodeId('a');
    scene.add({ id: A, kind: 'mark', layer: 'main', data: null, pose: { x: 500, y: 500, width: 20, height: 20 } } as never);
    const triangle: Path = {
      kind: 'polygon', commands: Uint8Array.of(PATH_M, PATH_L, PATH_L, PATH_Z),
      coords: Float32Array.of(0, 0, 100, 0, 0, 100), fillRule: 'nonzero',
    };
    scene.overrides.set(A, { pose: { x: 0, y: 0, width: 100, height: 100 }, path: triangle });
    scene.overrides.commit();
    const adapter = sceneToAdapter(scene);
    const { result } = renderHook(() => useSceneSelectTool({ scene, adapter }));
    expect(result.current.pickEvery(90, 90)).toEqual([]);
    expect(result.current.pickEvery(10, 10)).toEqual(['a']);
  });

  it('marquee and lasso pick through the index', () => {
    const scene = grid();
    const adapter = sceneToAdapter(scene);
    const full = scenePickSource(scene);
    const rect = { x: 100, y: 100, width: 75, height: 50 };
    const tri = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 0, y: 200 }];
    const each = { includeGroups: true };

    const before = pickIndexBuildCount();
    const marquee = adapter.hitTestArea!(rect);
    expect(marquee).toEqual(pickWalk(full, regionPickQuery(rectRegion(rect), 'intersect', AUTO_POSE_DESCRIPTOR, each)));
    expect(marquee.length).toBeGreaterThan(0);
    const lasso = adapter.hitTestLasso!(tri, 'enclosed');
    const region = regionOf(tri.flatMap((p) => [p.x, p.y]), undefined, false)!;
    expect(lasso).toEqual(pickWalk(full, regionPickQuery(region, 'enclosed', AUTO_POSE_DESCRIPTOR, each)));
    expect(lasso.length).toBeGreaterThan(0);
    expect(pickIndexBuildCount() - before).toBe(1);
  });
});
