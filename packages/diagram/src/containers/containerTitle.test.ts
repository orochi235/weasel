import { describe, expect, it } from 'vitest';
import { commitOps, createScene, type ActionDeps, type NodeId, type RectPose } from '@weasel-js/core';
import { withDiagramRegistry } from '../edge';
import { CONTAINER_STENCILS, containerBuild, lanesOf } from './containerStencils';
import { regionHeaderAt } from './containerTitle';

describe('regionHeaderAt', () => {
  it('finds a lane\'s header where it draws, in a pool away from the origin', () => {
    const scene = createScene<Record<string, unknown>, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry: withDiagramRegistry() });
    let n = 0;
    const built = containerBuild(CONTAINER_STENCILS[1]!, { x: 400, y: 300, width: 480, height: 240 }, { layer: 'main', newId: () => `n${n++}` });
    commitOps({ scene } as unknown as ActionDeps, built.ops, 'Insert');
    const [lane] = lanesOf(scene as never, built.id);
    const deps = (under: string) => ({ scene, nodeAtPoint: () => under as NodeId }) as unknown as ActionDeps;
    // The lane's header sits just past the pool's, at x 432..460 in world.
    expect(regionHeaderAt(deps(lane as string), { x: 445, y: 350 })).toBe(lane);
    expect(regionHeaderAt(deps(lane as string), { x: 410, y: 350 })).toBe(built.id);
    // Its far edge is the body's, where an insert lands.
    expect(regionHeaderAt(deps(lane as string), { x: 460, y: 350 })).toBeNull();
    // The lane's header box as stored, x 32..60, holds no part of it in world.
    expect(regionHeaderAt(deps(lane as string), { x: 45, y: 20 })).toBeNull();
  });

  it('finds a turned region\'s header where it draws', () => {
    const scene = createScene<Record<string, unknown>, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry: withDiagramRegistry() });
    let n = 0;
    const built = containerBuild(CONTAINER_STENCILS[1]!, { x: 0, y: 0, width: 480, height: 240 }, { layer: 'main', newId: () => `n${n++}` });
    commitOps({ scene } as unknown as ActionDeps, built.ops, 'Insert');
    scene.setPose(built.id as NodeId, { ...(scene.get(built.id as NodeId)!.pose as RectPose), rotation: Math.PI / 2 });
    const deps = { scene, nodeAtPoint: () => built.id as NodeId } as unknown as ActionDeps;
    // The left header strip, x 0..32, turned a quarter about (240, 120), runs along the top: y -120..-88.
    expect(regionHeaderAt(deps, { x: 240, y: -100 })).toBe(built.id);
    expect(regionHeaderAt(deps, { x: 10, y: 120 })).toBeNull();
  });
});
