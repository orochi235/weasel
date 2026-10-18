/**
 * Path effects in a scene whose containers compose frames: a blend over two
 * shapes held in a turned, offset container. Expected positions are worked
 * by hand from the container's frame.
 */
import { describe, expect, it } from 'vitest';
import { boundsOfPath, identity, multiply, rectPath, transformPath, type Affine, type Path } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import { defaultDrawOne } from 'canvas/defaultDrawOne';
import { scenePickSource } from 'canvas/pickWalk';
import { buildSceneViewCommands } from 'canvas/sceneViewRender';
import { RIGID_POSE_COMPOSITION, type PoseComposition } from 'core/scene/composePose';
import { effectivePose } from 'core/scene/effectivePose';
import { pathEffectNode } from 'core/scene/pathEffects/derive';
import { createScene } from 'core/scene/scene';
import { asNodeId, type AddNodeSpec, type RectPose } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import { PATH_EFFECT_DERIVATIONS, withPathEffectsRegistry } from './index';

const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const G = asNodeId('g');
const A = asNodeId('a');
const B = asNodeId('b');
const FX = asNodeId('fx');

type Spec = AddNodeSpec<unknown, 'main', RectPose>;

const leaf = (id: string, pose: RectPose, color: string, parent?: string): Spec => ({
  id: asNodeId(id), kind: 'leaf', layer: 'main', pose,
  data: { path: rectPath(0, 0, pose.width, pose.height), fill: { paint: { color } } },
  ...(parent ? { parent: asNodeId(parent) } : {}),
});

const blend = (parent?: string): Spec => ({
  ...pathEffectNode({ kind: 'blend', steps: 3 }, [A, B], 'main', PATH_EFFECT_DERIVATIONS),
  id: FX,
  ...(parent ? { parent: asNodeId(parent) } : {}),
});

/** `a` and `b` inside a container at (200, 100) turned a quarter turn, the
 *  blend beside them in it. */
function framed(composition: PoseComposition<RectPose> = RIGID_POSE_COMPOSITION) {
  return createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    registry: withPathEffectsRegistry(),
    composition,
    initial: [
      { id: G, kind: 'container', layer: 'main', pose: { x: 200, y: 100, width: 100, height: 100, rotation: Math.PI / 2 }, data: {} },
      leaf('a', { x: 0, y: 0, width: 20, height: 10 }, '#ff0000', 'g'),
      blend('g'),
      leaf('b', { x: 80, y: 40, width: 20, height: 10 }, '#0000ff', 'g'),
    ],
  });
}

/** Every path drawn, each carried through the transforms of the groups
 *  around it, so a turn applied as a group transform counts. */
function paths(cmds: readonly DrawCommand[], m: Affine = identity()): Path[] {
  const out: Path[] = [];
  for (const cmd of cmds) {
    if (cmd.kind === 'path') out.push(transformPath((cmd as { path: Path }).path, m));
    else if (cmd.kind === 'group') {
      const t = cmd.transform;
      out.push(...paths(cmd.children, t ? multiply(m, [t[0]!, t[1]!, t[3]!, t[4]!, t[6]!, t[7]!]) : m));
    }
  }
  return out;
}

const middle = (path: Path) => {
  const b = boundsOfPath(path);
  return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2), w: Math.round(b.width), h: Math.round(b.height) };
};

describe('a blend inside a container that composes frames', () => {
  it('paints its steps between where its sources are painted', () => {
    const scene = framed();
    const drawn = paths(buildSceneViewCommands(scene, VIEW, defaultDrawOne)).map(middle);
    // a's middle, local (10,5), and b's, local (90,45), from the container's
    // middle (50,50): (-40,-45) and (40,-5), turned a quarter: (45,-40) and
    // (5,40), so (295,110) and (255,190) on the page. Each source turns to
    // 10 wide by 20 tall.
    expect(drawn).toContainEqual({ x: 295, y: 110, w: 10, h: 20 });
    expect(drawn).toContainEqual({ x: 255, y: 190, w: 10, h: 20 });
    // The steps, a quarter of the way along apart.
    expect(drawn).toContainEqual({ x: 285, y: 130, w: 10, h: 20 });
    expect(drawn).toContainEqual({ x: 275, y: 150, w: 10, h: 20 });
    expect(drawn).toContainEqual({ x: 265, y: 170, w: 10, h: 20 });
    expect(drawn.filter((d) => d.w === 10 && d.h === 20)).toHaveLength(5);
  });

  it('is picked where it is painted', () => {
    const scene = framed();
    const picked = scenePickSource(scene).derivedPathOf!(scene.get(FX)! as never)!;
    expect(middle(picked)).toEqual({ x: 275, y: 150, w: 30, h: 60 });
  });

  it('follows a source that is edited, and the container when it moves', () => {
    const scene = framed();
    scene.setPose(B, { x: 80, y: 0, width: 20, height: 10 });
    let drawn = paths(buildSceneViewCommands(scene, VIEW, defaultDrawOne)).map(middle);
    // b's middle now local (90,5): (40,-45) turned is (45,40), so (295,190).
    expect(drawn).toContainEqual({ x: 295, y: 150, w: 10, h: 20 });
    scene.setPose(G, { x: 0, y: 100, width: 100, height: 100, rotation: Math.PI / 2 });
    drawn = paths(buildSceneViewCommands(scene, VIEW, defaultDrawOne)).map(middle);
    expect(drawn).toContainEqual({ x: 95, y: 150, w: 10, h: 20 });
  });

  it('boxes what it paints when it sits outside the container, as a root', () => {
    const scene = framed();
    scene.move(FX, null);
    const drawn = paths(buildSceneViewCommands(scene, VIEW, defaultDrawOne)).map(middle);
    expect(drawn).toContainEqual({ x: 275, y: 150, w: 10, h: 20 });
    // A root's pose is world: the steps run (260,120) to (290,180).
    expect(effectivePose(scene, scene.get(FX)!)).toMatchObject({ x: 260, y: 120, width: 30, height: 60 });
  });

  it('boxes what it paints, so selection chrome sits over the steps', () => {
    const scene = framed();
    const pose = effectivePose(scene, scene.get(FX)!);
    // Local bounds of the steps, which the container's frame turns onto the page.
    expect(pose).toMatchObject({ x: 20, y: 10, width: 60, height: 30 });
  });
});
