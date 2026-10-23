/**
 * A path effect whose source shows a pose override's path. The override path is in the frame
 * its painter draws in — the unturned box, inside the source's container — so an effect has to
 * read it where it is painted. Each case compares against the same source with no override,
 * showing the same outline from its data.
 */
import { describe, expect, it } from 'vitest';
import { boundsOfPath, rectPath, type Path } from '@weasel-js/geom';
import { scenePickSource } from 'canvas/pickWalk';
import { RIGID_POSE_COMPOSITION } from 'core/scene/composePose';
import { effectivePose } from 'core/scene/effectivePose';
import { pathEffectNode } from 'core/scene/pathEffects/derive';
import { createScene } from 'core/scene/scene';
import { asNodeId, type AddNodeSpec, type RectPose } from 'core/scene/types';
import { PATH_EFFECT_DERIVATIONS, withPathEffectsRegistry } from './index';

const G = asNodeId('g');
const A = asNodeId('a');
const B = asNodeId('b');
const FX = asNodeId('fx');

type Spec = AddNodeSpec<unknown, 'main', RectPose>;

const leaf = (id: string, pose: RectPose, parent?: string): Spec => ({
  id: asNodeId(id), kind: 'mark', layer: 'main', pose,
  data: { path: rectPath(0, 0, pose.width, pose.height), fill: { paint: { color: '#f00' } } },
  ...(parent ? { parent: asNodeId(parent) } : {}),
});

// `rotate: false` so the steps interpolate outlines alone: an override's path carries no turn
// for the blend to read, and the comparison is of where the outline is.
const blend = (): Spec => ({
  ...pathEffectNode({ kind: 'blend', steps: 3, rotate: false }, [A, B], 'main', PATH_EFFECT_DERIVATIONS),
  id: FX,
});

const round = (b: { x: number; y: number; width: number; height: number }) =>
  [b.x, b.y, b.width, b.height].map(Math.round);

/** The override that shows `pose`'s own outline: its data path where its box is. */
const sameOutline = (pose: RectPose): { pose: RectPose; path: Path } =>
  ({ pose, path: rectPath(pose.x, pose.y, pose.width, pose.height) });

describe('a path effect over a source shown by a pose override', () => {
  it('reads the override path turned as it is painted', () => {
    const turned: RectPose = { x: 40, y: 0, width: 40, height: 10, rotation: Math.PI / 2 };
    const make = () => createScene<unknown, 'main', RectPose>({
      systemLayers: [{ id: 'main' }],
      registry: withPathEffectsRegistry(),
      initial: [leaf('a', turned), leaf('b', { x: 200, y: 0, width: 10, height: 10 }), blend()],
    });
    const plain = make();
    const shown = make();
    shown.overrides.set(A, sameOutline(turned));
    expect(round(effectivePose(shown, shown.get(FX)!))).toEqual(round(effectivePose(plain, plain.get(FX)!)));
  });

  describe('inside a container that composes frames', () => {
    const make = () => createScene<unknown, 'main', RectPose>({
      systemLayers: [{ id: 'main' }],
      registry: withPathEffectsRegistry(),
      composition: RIGID_POSE_COMPOSITION,
      initial: [
        { id: G, kind: 'group', layer: 'main', pose: { x: 200, y: 100, width: 100, height: 100, rotation: Math.PI / 2 }, data: {} },
        leaf('a', { x: 0, y: 0, width: 40, height: 10 }, 'g'),
        leaf('b', { x: 400, y: 0, width: 10, height: 10 }),
        blend(),
      ],
    });

    it('boxes itself from the override path where the container puts it', () => {
      const plain = make();
      const shown = make();
      shown.overrides.set(A, sameOutline({ x: 0, y: 0, width: 40, height: 10 }));
      expect(round(effectivePose(shown, shown.get(FX)!))).toEqual(round(effectivePose(plain, plain.get(FX)!)));
    });

    it('is picked from the override path where the container puts it', () => {
      const plain = make();
      const shown = make();
      shown.overrides.set(A, sameOutline({ x: 0, y: 0, width: 40, height: 10 }));
      const picked = (scene: typeof plain) =>
        round(boundsOfPath(scenePickSource(scene).derivedPathOf!(scene.get(FX)! as never)!));
      expect(picked(shown)).toEqual(picked(plain));
    });
  });
});
