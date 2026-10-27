/** A group inside a boolean group is one operand: the union of what it shows. */
import { describe, expect, it } from 'vitest';
import { pathContainsPoint, type Path } from '@weasel-js/geom';
import { createScene } from 'core/scene/scene';
import { booleanGroupFields } from 'core/scene/booleanGroup';
import { RECT_POSE_COMPOSITION } from 'core/scene/composePose';
import { documentOf } from 'core/scene/documentOf';
import { derivedDepOf } from 'core/scene/effectivePose';
import type { NodeId, RectPose, Scene } from 'core/scene/types';
import type { PoseComposition } from 'core/scene/composeFrame';
import { sceneDerivedPathOf } from './derivedPath';
import './NodeShape';

type Data = { shape?: string; boolean?: string };
const box = (x: number, y: number, width = 100, height = 100): RectPose => ({ x, y, width, height });

/** A boolean group of a back square at (0, 0), then a group holding two squares, at (50, 50) and (150, 50). */
function makeScene(op: string, composition?: PoseComposition<RectPose>) {
  const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }], ...(composition ? { composition } : {}) });
  const group = scene.add({ ...booleanGroupFields<RectPose>(), layer: 'main', pose: box(0, 0, 0, 0), data: { boolean: op } });
  scene.add({ kind: 'mark', layer: 'main', parent: group, pose: box(0, 0), data: { shape: 'rect' } });
  const inner = scene.add({ kind: 'group', layer: 'main', parent: group, pose: composition ? box(50, 50, 200, 100) : box(0, 0), data: {} });
  const a = scene.add({ kind: 'mark', layer: 'main', parent: inner, pose: composition ? box(0, 0) : box(50, 50), data: { shape: 'rect' } });
  const b = scene.add({ kind: 'mark', layer: 'main', parent: inner, pose: composition ? box(100, 0) : box(150, 50), data: { shape: 'rect' } });
  return { scene, group, inner, a, b };
}

const pathOf = (scene: Scene<Data, 'main', RectPose>, id: NodeId): Path | null => sceneDerivedPathOf(scene)(scene.get(id)!);
const covers = (path: Path | null, x: number, y: number) => path !== null && pathContainsPoint(path, x, y);

describe('a group inside a boolean group', () => {
  it('subtracts as one operand, the union of its children', () => {
    const { scene, group } = makeScene('subtract');
    const p = pathOf(scene, group);
    expect([covers(p, 25, 25), covers(p, 75, 75), covers(p, 175, 75)]).toEqual([true, false, false]);
  });

  it('recomputes when a grandchild moves or is hidden', () => {
    const { scene, group, a, b } = makeScene('union');
    expect(covers(pathOf(scene, group), 225, 125)).toBe(true);
    scene.setPose(b, box(400, 400));
    expect(covers(pathOf(scene, group), 225, 125)).toBe(false);
    expect(covers(pathOf(scene, group), 450, 450)).toBe(true);
    scene.setHidden(a, true);
    expect(covers(pathOf(scene, group), 125, 125)).toBe(false);
  });

  it('places its children through its frame when the scene composes poses', () => {
    const { scene, group } = makeScene('subtract', RECT_POSE_COMPOSITION);
    for (const p of [pathOf(scene, group), derivedDepOf(documentOf(scene), group)!.path]) {
      expect([covers(p, 25, 25), covers(p, 75, 75), covers(p, 175, 75)]).toEqual([true, false, false]);
    }
  });

  it('notices a grandchild that moved under a pose override', () => {
    const { scene, group, b } = makeScene('union');
    expect(covers(pathOf(scene, group), 225, 125)).toBe(true);
    scene.overrides.set(b, { pose: box(400, 400) } as never);
    expect(covers(pathOf(scene, group), 450, 450)).toBe(true);
  });
});
