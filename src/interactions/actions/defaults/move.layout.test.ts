import { describe, it, expect } from 'vitest';
import { moveAction } from './move';
import type { InvocationCtx } from '../invoker';
import { tileGrid } from '../../../layout/strategies';
import type { LayoutDep } from '../depSchema';
import type { NodeId } from 'core/scene/types';

type P = { x: number; y: number; width: number; height: number };

interface StubScene {
  poses: Map<string, P>;
  childMap: Map<string, NodeId[]>;
  roots: NodeId[];
  get(id: NodeId): { pose: P; parent: NodeId | null } | undefined;
  childrenOf(id: NodeId): readonly NodeId[];
}

function makeScene(
  poses: Record<string, P>,
  parents: Record<string, string | null>,
  childMap: Record<string, string[]>,
  roots: string[],
): StubScene {
  const p = new Map(Object.entries(poses));
  const c = new Map(Object.entries(childMap).map(([k, v]) => [k, v as NodeId[]]));
  return {
    poses: p,
    childMap: c,
    roots: roots as NodeId[],
    get(id) {
      if (!p.has(id)) return undefined;
      return { pose: p.get(id)!, parent: (parents[id] ?? null) as NodeId | null };
    },
    childrenOf(id) { return c.get(id) ?? []; },
  };
}

function makeCtx(scene: StubScene, selectionIds: string[], drag?: InvocationCtx['drag']): InvocationCtx {
  const grid = tileGrid<P>({ cols: 2, rows: 1 });
  const layout: LayoutDep = { getLayout: (id) => (id === 'C' ? (grid as never) : null) };
  return {
    world: { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { selection: { get: () => selectionIds as NodeId[] }, scene, layout },
    drag,
  } as unknown as InvocationCtx;
}

describe('moveAction layout reflow', () => {
  it('folds destination reflow into previews when dragging within a tileGrid', () => {
    const scene = makeScene(
      {
        C: { x: 0, y: 0, width: 100, height: 100 },
        a: { x: 0, y: 0, width: 50, height: 100 },
        b: { x: 50, y: 0, width: 50, height: 100 },
      },
      { C: null, a: 'C', b: 'C' },
      { C: ['a', 'b'] },
      ['C'],
    );
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(makeCtx(scene, ['a']));
    handle.onMove!(makeCtx(scene, ['a'], {
      start: { x: 25, y: 50 },
      current: { x: 75, y: 50 },
      delta: { x: 50, y: 0 },
    }) as InvocationCtx);

    const ids = [...(handle.previewIds!() as Iterable<string>)];
    expect(ids).toContain('b'); // sibling reflowed into the preview channel
    const bPose = handle.previewPose!('b') as P;
    expect(bPose.x).toBe(0); // b swapped to cell 0
  });
});
