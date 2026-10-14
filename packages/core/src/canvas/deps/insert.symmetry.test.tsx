import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DepRegistryProvider, useDepRegistry, useDepSource, type DepRegistry } from '@weasel-js/routing/react';
import { PathBuilder, boundsOfPath } from '@weasel-js/geom';
import type { Op } from 'core/ops/types';
import type { Scene } from 'core/scene/types';
import type { Symmetry } from 'features/symmetry';
import { useInsertDepSource } from './insert';

function makeScene(): Scene<unknown, string, unknown> {
  let minted = 0;
  return {
    layers: [{ id: 'default' }],
    mintId: () => `srv-${minted++}`,
  } as unknown as Scene<unknown, string, unknown>;
}

function wire(symmetry: Symmetry | null) {
  const applyOps = vi.fn<(ops: Op[], label?: string) => void>();
  let reg!: DepRegistry;
  function Wire() {
    useInsertDepSource(makeScene(), { applyOps });
    useDepSource('symmetry', () => ({ get: () => symmetry, set: () => {} }));
    reg = useDepRegistry();
    return null;
  }
  render(<DepRegistryProvider><Wire /></DepRegistryProvider>);
  return { applyOps, insert: reg.get('insert')! };
}

const stroke = () => new PathBuilder().moveTo(20, 10).lineTo(60, 50).build();
type Inserted = { id: string; data: { path: { coords: ArrayLike<number> } } };
const insertedBy = (ops: readonly Op[]) => ops.map((op) => (op.args as { node: Inserted }).node);

describe('useInsertDepSource under symmetry', () => {
  it('commits the drawn node and its mirror in one batch', () => {
    const { applyOps, insert } = wire({ axis: 'vertical', center: { x: 100, y: 0 } });
    const path = stroke();
    const id = insert.commit(boundsOfPath(path), { kind: 'path', path, closed: false });
    expect(id).toBe('srv-0');
    expect(applyOps).toHaveBeenCalledTimes(1);
    const nodes = insertedBy(applyOps.mock.calls[0][0]);
    expect(nodes.map((n) => n.id)).toEqual(['srv-0', 'srv-1']);
    expect(Array.from(nodes[1].data.path.coords)).toEqual([180, 10, 140, 50]);
  });

  it('hands the twins back from build, for a caller batching more', () => {
    const { insert } = wire({ axis: 'both', center: { x: 100, y: 100 } });
    const path = stroke();
    const built = insert.build!(boundsOfPath(path), { kind: 'path', path, closed: false })!;
    expect(built.id).toBe('srv-0');
    expect(built.ops).toHaveLength(4);
  });

  it('inserts one node while the setting is off', () => {
    const { applyOps, insert } = wire(null);
    insert.commit({ x: 0, y: 0, width: 10, height: 10 }, { kind: 'rect' });
    expect(applyOps.mock.calls[0][0]).toHaveLength(1);
  });
});
