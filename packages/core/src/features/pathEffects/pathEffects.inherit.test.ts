/**
 * A path effect over a source whose fill is `'inherit'`: the effect paints what the source shows,
 * which is its container's fill, and follows that fill when the container's changes. Each case
 * compares against the same source with that fill written out.
 */
import { describe, expect, it } from 'vitest';
import { rectPath } from '@weasel-js/geom';
import { derivedPartsOf } from 'core/scene/derivedParts';
import { effectivePose } from 'core/scene/effectivePose';
import { pathEffectNode } from 'core/scene/pathEffects/derive';
import { createScene } from 'core/scene/scene';
import { asNodeId, type AddNodeSpec, type RectPose } from 'core/scene/types';
import { sceneDerivedPathOf } from 'canvas/derivedPath';
import { PATH_EFFECT_DERIVATIONS, withPathEffectsRegistry } from './index';

const G = asNodeId('g');
const A = asNodeId('a');
const B = asNodeId('b');
const FX = asNodeId('fx');

type Spec = AddNodeSpec<unknown, 'main', RectPose>;

const BLUE = { paint: { color: '#00f' } };
const GREEN = { paint: { color: '#0f0' } };
const RED = { paint: { color: '#f00' } };

const leaf = (id: string, pose: RectPose, fill: unknown, parent?: string): Spec => ({
  id: asNodeId(id), kind: 'leaf', layer: 'main', pose,
  data: { path: rectPath(0, 0, pose.width, pose.height), fill },
  ...(parent ? { parent: asNodeId(parent) } : {}),
});

const make = (aFill: unknown = 'inherit', gFill: unknown = BLUE) => createScene<unknown, 'main', RectPose>({
  systemLayers: [{ id: 'main' }],
  registry: withPathEffectsRegistry(),
  initial: [
    { id: G, kind: 'container', layer: 'main', pose: { x: 0, y: 0, width: 100, height: 100 }, data: { fill: gFill } },
    leaf('a', { x: 0, y: 0, width: 10, height: 10 }, aFill, 'g'),
    leaf('b', { x: 200, y: 0, width: 10, height: 10 }, RED),
    { ...pathEffectNode({ kind: 'blend', steps: 1, rotate: false }, [A, B], 'main', PATH_EFFECT_DERIVATIONS), id: FX },
  ],
});

describe('a path effect over a source that inherits its fill', () => {
  const firstFill = (scene: ReturnType<typeof make>) => {
    effectivePose(scene, scene.get(FX)!);
    return derivedPartsOf(sceneDerivedPathOf(scene)(scene.get(FX)!))?.[0]?.fill;
  };

  it('paints the source in its container\'s fill', () => {
    expect(firstFill(make())).toEqual(firstFill(make(BLUE)));
  });

  it('follows the container\'s fill when it changes', () => {
    const scene = make();
    expect(firstFill(scene)).toEqual(firstFill(make(BLUE)));
    scene.update(G, { data: { fill: GREEN } });
    expect(firstFill(scene)).toEqual(firstFill(make(GREEN)));
  });
});
