import { describe, expect, it, vi } from 'vitest';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import { sceneMutators } from 'core/scene/sceneMutators';
import { createSetDependsOnOp } from './setDependsOn';
import { rebuildOp } from './registry';

describe('createSetDependsOnOp', () => {
  it('applies the new sources to the adapter, and inverts back to the old', () => {
    const setDependsOn = vi.fn();
    const op = createSetDependsOnOp({ id: 'e', from: ['a', 'b'], to: ['a', 'b', 'c'] });
    op.apply({ setDependsOn });
    op.invert().apply({ setDependsOn });
    expect(setDependsOn.mock.calls).toEqual([['e', ['a', 'b', 'c']], ['e', ['a', 'b']]]);
  });

  it('round-trips through the registry', () => {
    const a = vi.fn();
    const b = vi.fn();
    const original = createSetDependsOnOp({ id: 'e', from: undefined, to: ['a'], label: 'Retarget' });
    original.apply({ setDependsOn: a });
    rebuildOp(original.name!, original.args)!.apply({ setDependsOn: b });
    expect(b.mock.calls).toEqual(a.mock.calls);
  });

  it('retargets a scene node through its mutators, as one undo step', () => {
    const leaf = (id: string) => ({
      id: asNodeId(id), kind: 'mark' as const, layer: 'default' as const,
      pose: { x: 0, y: 0, width: 1, height: 1 }, data: {},
    });
    const scene = createScene<unknown, 'default', { x: number; y: number; width: number; height: number }>({
      systemLayers: [{ id: 'default' }],
      initial: [leaf('a'), leaf('b'), leaf('c'), { ...leaf('e'), dependsOn: [asNodeId('a'), asNodeId('b')] }],
    });
    const op = createSetDependsOnOp({ id: 'e', from: ['a', 'b'], to: ['a', 'b', 'c'] });
    scene.applyBatch([op], 'Retarget', sceneMutators(scene));
    expect(scene.get(asNodeId('e'))!.dependsOn).toEqual(['a', 'b', 'c']);
    scene.undo();
    expect(scene.get(asNodeId('e'))!.dependsOn).toEqual(['a', 'b']);
  });
});
