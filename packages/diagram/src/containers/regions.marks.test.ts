import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { commitOps, createScene, type ActionDeps, type NodeId, type RectPose } from '@weasel-js/core';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import { pickWalk, scenePickSource } from 'canvas/pickWalk';
import { scenePointQuery } from 'canvas/SceneCanvas/scenePointQuery';
import { insertParent } from 'interactions/actions/insert/parent';
import { withDiagramRegistry } from '../edge';
import { registerDiagramShape } from '../shape';
import { diagramCanDropInto } from './canDropInto';
import { CONTAINER_STENCILS, containerBuild, lanesOf } from './containerStencils';

const makeScene = () =>
  createScene<Record<string, unknown>, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry: withDiagramRegistry() });

function build(scene: ReturnType<typeof makeScene>, id: string, at: RectPose): string {
  const stencil = CONTAINER_STENCILS.find((s) => s.id === id)!;
  let n = 0;
  const built = containerBuild(stencil, at, { layer: 'main', newId: () => `${id}${n++ === 0 ? '' : `-${n - 1}`}` });
  commitOps({ scene } as unknown as ActionDeps, built.ops, 'Insert');
  return built.id;
}

let unregister = () => {};
beforeAll(() => { unregister = registerDiagramShape(); });
afterAll(() => unregister());

describe('regions are marks', () => {
  it('builds a pool and its lanes as marks', () => {
    const scene = makeScene();
    const pool = build(scene, 'pool-rows', { x: 0, y: 0, width: 480, height: 240 });
    expect(scene.get(pool as NodeId)!.kind).toBe('mark');
    for (const lane of lanesOf(scene as never, pool)) expect(scene.get(lane as NodeId)!.kind).toBe('mark');
  });

  it('is hit by a press inside an unfilled lane with no member under it', () => {
    const scene = makeScene();
    const pool = build(scene, 'pool-rows', { x: 0, y: 0, width: 480, height: 240 });
    const [first] = lanesOf(scene as never, pool);
    const hits = pickWalk(scenePickSource(scene as never), {
      ...scenePointQuery(AUTO_POSE_DESCRIPTOR, true, 0)(300, 60, { x: 1, y: 1 }),
      includeGroups: true,
    });
    expect(hits).toContain(first);
  });

  it('takes an insert into a lane, though no node is minted yet to ask about', () => {
    const scene = makeScene();
    const pool = build(scene, 'pool-rows', { x: 0, y: 0, width: 480, height: 240 });
    const [lane] = lanesOf(scene as never, pool);
    const can = diagramCanDropInto(scene);
    expect(insertParent(scene as never, lane as string, can)).toBe(lane);
    const box = build(scene, 'container', { x: 600, y: 0, width: 240, height: 160 });
    expect(insertParent(scene as never, box, can)).toBe(box);
  });

  it('refuses an insert into a shape body', () => {
    const scene = makeScene();
    scene.add({
      id: 's' as NodeId, kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 40, height: 20 }, data: { diagram: { outline: 'rect' } },
    });
    expect(insertParent(scene as never, 's', diagramCanDropInto(scene))).toBeNull();
  });
});
