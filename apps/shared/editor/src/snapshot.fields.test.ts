import { asNodeId, createScene, type SerializedScene, type UnitScope } from '@weasel-js/core';
import { symmetryCopies, symmetryGroupSpec, symmetryRegistry } from '@weasel-js/symmetry';
import { describe, expect, it } from 'vitest';
import { nodeSpecsFromSnapshot, serializeReplacer } from './snapshot';

const MM: UnitScope = { system: { base: 'mm', units: { mm: 1, cm: 10 } }, scale: 1 / 25.4 };
const BOX = { x: 0, y: 0, width: 10, height: 10 };

describe('a reloaded snapshot keeps every field it saved', () => {
  it('restores a symmetry group\'s copies, a declared clip and a unit scope', () => {
    const scene = createScene<unknown, 'main', typeof BOX>({ systemLayers: [{ id: 'main' }], registry: symmetryRegistry as never });
    scene.add({ ...symmetryGroupSpec({ layer: 'main', center: { x: 0, y: 0 }, id: asNodeId('sym') }) } as never);
    scene.add({ id: asNodeId('clip'), kind: 'group', layer: 'main', pose: BOX, data: {}, clip: 'outline' });
    scene.add({ id: asNodeId('mm'), kind: 'group', layer: 'main', pose: BOX, data: {}, units: MM });
    const json = JSON.parse(JSON.stringify(scene.toJSON(), serializeReplacer)) as SerializedScene<unknown, 'main', typeof BOX>;

    const specs = nodeSpecsFromSnapshot(json, symmetryRegistry as never);
    const byId = (id: string) => specs.find((s) => s.id === asNodeId(id));
    expect(byId('sym')?.copiesFromPose).toBe(symmetryCopies);
    expect(byId('clip')?.clip).toBe('outline');
    expect(byId('mm')?.units).toEqual(MM);
  });

  it('leaves a node as authored when the registry lacks a key it names, and reports the key', () => {
    const json: SerializedScene<unknown, 'main', typeof BOX> = {
      version: 2,
      systemLayers: [{ id: 'main' }],
      nodes: [{ id: 'g', kind: 'group', layer: 'main', pose: BOX, data: {}, copiesFromPoseKey: 'gone' }],
    };
    const skipped: unknown[] = [];
    const [g] = nodeSpecsFromSnapshot(json, {}, undefined, { onSkip: (s) => skipped.push(s) });
    expect(g).toMatchObject({ id: asNodeId('g'), kind: 'group' });
    expect(g!.copiesFromPose).toBeUndefined();
    expect(skipped).toEqual([{ id: 'g', field: 'copiesFromPose', key: 'gone' }]);
  });
});
