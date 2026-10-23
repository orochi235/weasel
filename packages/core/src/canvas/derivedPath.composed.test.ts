import { describe, it, expect } from 'vitest';
import { wireSceneSlotToScene } from './sceneSlotWiring';
import { defaultDrawOne } from './defaultDrawOne';
import { buildSceneViewCommands } from './sceneViewRender';
import { scenePickSource } from './pickWalk';
import { createScene } from 'core/scene/scene';
import type { DerivedDep, Node, RectPose } from 'core/scene/types';
import { IDENTITY_POSE_COMPOSITION, RECT_POSE_COMPOSITION, type PoseComposition } from 'core/scene/composePose';
import { type Path, linePath } from '@weasel-js/geom';
import type { View } from 'core/viewport/view';
import type { DrawCommand } from '@weasel-js/renderer';

const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const rect = (x: number, y: number): RectPose => ({ x, y, width: 10, height: 10 });

/** A container at (100, 100) holding `a` and `b` at local x = 0 and 100, and
 *  a root edge deriving a line between them. Under a composing strategy the
 *  two are painted at (100, 100) and (200, 100). */
function makeFramedEdgeScene(composition: PoseComposition<RectPose> = RECT_POSE_COMPOSITION) {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }], composition });
  const box = scene.add({ kind: 'group', layer: 'main', pose: rect(100, 100), data: {} });
  const a = scene.add({ kind: 'mark', layer: 'main', pose: rect(0, 0), data: {}, parent: box });
  const b = scene.add({ kind: 'mark', layer: 'main', pose: rect(100, 0), data: {}, parent: box });
  const edge = scene.add({
    kind: 'mark', layer: 'main', pose: rect(0, 0), data: {},
    dependsOn: [a, b],
    derivePath: (_node: Node<unknown, string, RectPose>, deps: readonly (DerivedDep<RectPose> | undefined)[]) => {
      const from = deps[0]?.pose;
      const to = deps[1]?.pose;
      return from && to ? linePath({ x: from.x, y: from.y }, { x: to.x, y: to.y }) : null;
    },
  });
  return { scene, box, a, b, edge };
}

const WORLD_LINE = linePath({ x: 100, y: 100 }, { x: 200, y: 100 });

function paths(cmds: readonly DrawCommand[]): Path[] {
  const out: Path[] = [];
  for (const cmd of cmds) {
    if (cmd.kind === 'path') out.push((cmd as { path: Path }).path);
    else if (cmd.kind === 'group') out.push(...paths(cmd.children));
  }
  return out;
}

describe('a derived path under a composing pose strategy', () => {
  it('headless: is drawn between the composed poses of its dependencies', () => {
    const { scene } = makeFramedEdgeScene();
    const cmds = buildSceneViewCommands(scene, VIEW, defaultDrawOne);
    expect(paths(cmds)).toContainEqual(WORLD_LINE);
  });

  it('live: the scene-wired slot draws and clips from the composed poses', () => {
    const { scene, edge } = makeFramedEdgeScene();
    const slot = wireSceneSlotToScene({ drawOne: defaultDrawOne }, scene);
    const node = scene.get(edge)!;
    expect(paths(slot.drawOne(node, node.pose, VIEW))).toEqual([WORLD_LINE]);
    expect(slot.derivedPathOf!(node, node.pose)).toEqual(WORLD_LINE);
  });

  it('is drawn where it is picked', () => {
    const { scene, edge } = makeFramedEdgeScene();
    const node = scene.get(edge)!;
    const picked = scenePickSource(scene).derivedPathOf!(node as never);
    const slot = wireSceneSlotToScene({ drawOne: defaultDrawOne }, scene);
    expect(slot.derivedPathOf!(node, node.pose)).toEqual(picked);
    expect(picked).toEqual(WORLD_LINE);
  });

  it('follows the container when it moves', () => {
    const { scene, box, edge } = makeFramedEdgeScene();
    const slot = wireSceneSlotToScene({ drawOne: defaultDrawOne }, scene);
    const node = scene.get(edge)!;
    expect(slot.derivedPathOf!(node, node.pose)).toEqual(WORLD_LINE);
    scene.setPose(box, rect(0, 50));
    expect(slot.derivedPathOf!(scene.get(edge)!, node.pose))
      .toEqual(linePath({ x: 0, y: 50 }, { x: 100, y: 50 }));
  });

  it('leaves an absolute-pose scene reading stored poses', () => {
    const { scene, edge } = makeFramedEdgeScene(IDENTITY_POSE_COMPOSITION as PoseComposition<RectPose>);
    const slot = wireSceneSlotToScene({ drawOne: defaultDrawOne }, scene);
    const node = scene.get(edge)!;
    expect(slot.derivedPathOf!(node, node.pose)).toEqual(linePath({ x: 0, y: 0 }, { x: 100, y: 0 }));
  });
});
