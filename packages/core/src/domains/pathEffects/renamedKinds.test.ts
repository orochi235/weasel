import { describe, expect, it } from 'vitest';
import { rectPath } from '@weasel-js/geom';
import { effectivePose } from 'core/scene/effectivePose';
import { pathEffectNode, pathEffectOf } from 'core/scene/pathEffects/derive';
import { createScene, sceneFromJSON } from 'core/scene/scene';
import { asNodeId, type AddNodeSpec, type RectPose } from 'core/scene/types';
import { PATH_EFFECT_DERIVATIONS, withPathEffectsRegistry } from './index';

const A = asNodeId('a');
const B = asNodeId('b');
const FX = asNodeId('fx');

type Spec = AddNodeSpec<unknown, 'main', RectPose>;

const leaf = (id: string, pose: RectPose): Spec => ({
  id: asNodeId(id), kind: 'mark', layer: 'main', pose,
  data: { path: rectPath(0, 0, pose.width, pose.height), fill: { paint: { color: '#f00' } } },
});

const make = () => createScene<unknown, 'main', RectPose>({
  systemLayers: [{ id: 'main' }],
  registry: withPathEffectsRegistry(),
  initial: [
    leaf('a', { x: 0, y: 0, width: 10, height: 10 }),
    leaf('b', { x: 200, y: 50, width: 30, height: 30 }),
    { ...pathEffectNode({ kind: 'tween', steps: 3 }, [A, B], 'main', PATH_EFFECT_DERIVATIONS), id: FX },
  ],
});

describe('a path effect saved under a kind it was renamed from', () => {
  it('reads a blend as a tween, the same object each read', () => {
    const data = { pathEffect: { kind: 'blend', steps: 4, spaceBy: 'count' } };
    const first = pathEffectOf({ data });
    expect(first).toEqual({ kind: 'tween', steps: 4, spaceBy: 'count' });
    expect(pathEffectOf({ data })).toBe(first);
    expect(data.pathEffect.kind).toBe('blend');
  });

  it('loads a scene saved with a blend and draws it as the tween', () => {
    const now = make();
    const json = JSON.parse(JSON.stringify(now.toJSON())) as ReturnType<typeof now.toJSON>;
    const saved = json.nodes.find((n) => n.id === FX)!;
    (saved.data as { pathEffect: { kind: string } }).pathEffect.kind = 'blend';
    const loaded = sceneFromJSON(json, { registry: withPathEffectsRegistry() });
    expect(effectivePose(loaded, loaded.get(FX)!)).toEqual(effectivePose(now, now.get(FX)!));
  });
});
