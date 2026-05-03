import { renderHook, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useMoveInteraction } from './move';
import { polygonFromPoints, translatePath, type Path, type PolygonPath } from '../../../paths';
import type { MoveAdapter } from '../../../adapters/types';
import type { Op } from '../../../ops/types';

function makeAdapter(initial: Path) {
  const store = new Map<string, Path>([['a', initial]]);
  const batches: { ops: Op[]; label: string }[] = [];
  const adapter: MoveAdapter<{ id: string }, Path> = {
    getObject: (id) => (store.has(id) ? { id } : undefined),
    getPose: (id) => store.get(id)!,
    getParent: () => null,
    setPose: (id, pose) => store.set(id, pose),
    setParent: () => {},
    applyBatch: (ops, label) => {
      batches.push({ ops, label });
      for (const op of ops) op.apply({ setPose: (id: string, p: Path) => store.set(id, p) });
    },
  };
  return { adapter, batches, store };
}

describe('useMoveInteraction — Path TPose via translatePath', () => {
  it('drags a polygon: emitted op carries a translated polygon', () => {
    const tri = polygonFromPoints(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 10 },
      ],
    );
    const { adapter, batches, store } = makeAdapter(tri);

    const { result } = renderHook(() =>
      useMoveInteraction<{ id: string }, Path>(adapter, { translatePose: translatePath }),
    );
    act(() => result.current.start({ ids: ['a'], worldX: 0, worldY: 0, clientX: 0, clientY: 0 }));
    act(() =>
      result.current.move({
        worldX: 7,
        worldY: 3,
        clientX: 100,
        clientY: 100,
        modifiers: { alt: false, shift: false, meta: false, ctrl: false },
      }),
    );
    act(() => result.current.end());

    expect(batches).toHaveLength(1);
    const after = store.get('a') as PolygonPath;
    expect(after.kind).toBe('polygon');
    expect(after.coords[0]).toBeCloseTo(7, 5);
    expect(after.coords[1]).toBeCloseTo(3, 5);
    expect(after.coords[2]).toBeCloseTo(17, 5);
    expect(after.coords[3]).toBeCloseTo(3, 5);
    expect(after.coords[4]).toBeCloseTo(12, 5);
    expect(after.coords[5]).toBeCloseTo(13, 5);
  });
});
