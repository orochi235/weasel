import { describe, expect, it } from 'vitest';
import { createScene } from 'core/scene/scene';
import { sceneMutators } from 'core/scene/sceneMutators';
import { asNodeId } from 'core/scene/types';
import { createMoveToIndexOp } from './reorder';
import { createOpRegistry } from './registry';
import { createSetPoseOp } from './setPose';
import type { Op } from './types';
import { writtenBy } from './writtenBy';

type Pose = { x: number; y: number; width: number; height: number };

function scene(opRegistry?: ReturnType<typeof createOpRegistry>) {
  const leaf = (id: string) => ({
    id: asNodeId(id), kind: 'mark' as const, layer: 'default' as const,
    pose: { x: 0, y: 0, width: 1, height: 1 }, data: {},
  });
  return createScene<unknown, 'default', Pose>({
    systemLayers: [{ id: 'default' }],
    initial: [leaf('a'), leaf('b'), leaf('c')],
    ...(opRegistry ? { opRegistry } : {}),
  });
}

const order = (sc: ReturnType<typeof scene>) => sceneMutators(sc).getChildren(null);

describe('writtenBy', () => {
  it('reads the pose a batch leaves a node, without writing the scene', () => {
    const sc = scene();
    const to = { x: 5, y: 0, width: 1, height: 1 };
    const written = writtenBy(sc as never, [createSetPoseOp({ id: 'a', from: sc.get(asNodeId('a'))!.pose, to })]);
    expect(written?.get('a')?.pose).toEqual(to);
    expect(sc.get(asNodeId('a'))!.pose).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it('leaves an op its first apply, so its undo records the order the real apply finds', () => {
    const sc = scene();
    const m = sceneMutators(sc);
    const op: Op = createMoveToIndexOp({ ids: ['a'], parentId: null, index: 2 });
    writtenBy(sc as never, [op]);
    createMoveToIndexOp({ ids: ['c'], parentId: null, index: 0 }).apply(m);
    const found = order(sc);
    op.apply(m);
    op.invert().apply(m);
    expect(order(sc)).toEqual(found);
    expect((op.args as { prevPositions?: string[] }).prevPositions).toEqual(found);
  });

  it("rebuilds an op through the scene's own registry, not the kit default", () => {
    const registry = createOpRegistry({ parent: null });
    const applied: string[] = [];
    const hostOp = (tag: string): Op => ({
      name: 'host.nudge', args: { tag },
      apply(adapter) { applied.push(tag); (adapter as { setPose(id: string, p: unknown): void }).setPose('a', { x: 9, y: 0, width: 1, height: 1 }); },
      invert: () => hostOp(`${tag}-inverse`),
    });
    registry.register('host.nudge', (args) => hostOp(`${(args as { tag: string }).tag}-copy`));
    const sc = scene(registry);
    const written = writtenBy(sc as never, [hostOp('real')]);
    expect(applied).toEqual(['real-copy']);
    expect(written?.get('a')?.pose).toEqual({ x: 9, y: 0, width: 1, height: 1 });
  });
});
