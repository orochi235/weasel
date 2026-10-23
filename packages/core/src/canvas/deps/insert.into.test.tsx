import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { DepRegistryProvider, useDepRegistry, useDepSource, type DepRegistry } from '@weasel-js/routing/react';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'core/scene/composePose';
import type { Op } from 'core/ops/types';
import { useInsertDepSource } from './insert';

function wire(into: () => string | null) {
  const scene = createScene<unknown, 'back' | 'front', RectPose>({ systemLayers: [{ id: 'back' }, { id: 'front' }] });
  const group = scene.add({ kind: 'group', layer: 'front', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {} });
  const leaf = scene.add({ kind: 'mark', layer: 'back', pose: { x: 0, y: 0, width: 1, height: 1 }, data: {} });
  const applied: Op[][] = [];
  let reg!: DepRegistry;
  function Wire() {
    useDepSource('insertInto', () => ({ get: into }));
    useInsertDepSource(scene as never, { applyOps: (ops) => { applied.push(ops); } });
    reg = useDepRegistry();
    return null;
  }
  render(<DepRegistryProvider><Wire /></DepRegistryProvider>);
  const dep = (reg.get as (n: string) => { build: (b: unknown, e: unknown) => { ops: Op[] } | null })('insert');
  const nodeOf = () => {
    const built = dep.build({ x: 5, y: 5, width: 10, height: 10 }, { kind: 'rect' });
    return (built!.ops[0].args as { node: { parent?: string | null; layer: string } }).node;
  };
  return { group, leaf, nodeOf };
}

describe('useInsertDepSource: the insertInto dep', () => {
  it('puts the new node in the container it names, on that container\'s layer', () => {
    let target: string | null = null;
    const { group, nodeOf } = wire(() => target);
    expect(nodeOf().parent ?? null).toBeNull();
    target = group;
    const node = nodeOf();
    expect(node.parent).toBe(group);
    expect(node.layer).toBe('front');
  });

  it('inserts at the top of the tree when the id names no container', () => {
    let target: string | null = 'gone';
    const { leaf, nodeOf } = wire(() => target);
    expect(nodeOf().parent ?? null).toBeNull();
    target = leaf;
    expect(nodeOf().parent ?? null).toBeNull();
  });
});
