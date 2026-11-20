import { describe, expect, it } from 'vitest';
import { asNodeId, createScene, type RectPose } from '@weasel-js/core';
import { rectPath } from '@weasel-js/geom';
import { bakeSymmetry } from './bake';
import { createSymmetry } from './controller';
import { symmetryRegistry } from './group';
import { VERTICAL_AXIS } from './kinds';

function setup() {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry: symmetryRegistry });
  const sym = createSymmetry(scene as never);
  const group = sym.create({ center: { x: 0, y: 0 }, symmetry: { kind: 'mirror', angle: VERTICAL_AXIS } });
  scene.add({
    kind: 'mark', layer: 'main', parent: group, id: asNodeId('sq'),
    pose: { x: 20, y: 10, width: 10, height: 10 }, data: { path: rectPath(0, 0, 10, 10) },
  });
  return { scene, group };
}

describe('bakeSymmetry', () => {
  it('keeps the group\'s own stated fields and data, less its symmetry', () => {
    const { scene, group } = setup();
    scene.update(group, { data: { ...(scene.get(group)!.data as object), label: 'L' } });
    scene.setHidden(group, true);
    const baked = scene.get(bakeSymmetry(scene as never, group)!.group)!;
    expect(baked.data).toEqual({ label: 'L' });
    expect(baked).toMatchObject({ hidden: true });
  });

  it('keeps a copied container\'s own copies', () => {
    const { scene, group } = setup();
    const copies = () => [[1, 0, 0, 1, 0, 50] as const];
    const inner = scene.add({
      kind: 'group', layer: 'main', parent: group, pose: { x: 40, y: 0, width: 10, height: 10 }, data: {},
      copiesFromPose: copies as never,
    } as never);
    const baked = bakeSymmetry(scene as never, group)!.group;
    const groups = scene.childrenOf(baked).map((c) => scene.get(c)!).filter((n) => n.kind === 'group');
    expect(groups.map((n) => n.id === inner || (n as { copiesFromPose?: unknown }).copiesFromPose === copies)).toEqual([true, true]);
  });
});
