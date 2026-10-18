import { describe, expect, it, vi } from 'vitest';
import type { AffordanceHit, InvocationCtx, OngoingHandle, OngoingOverlay } from '@weasel-js/routing';
import { overlaysOf } from '@weasel-js/routing';
import { PATH_C, PATH_L, PATH_M, PATH_Z, pathToAnchors, type AnchorSet, type PolygonPath } from '@weasel-js/geom';
import type { PathEditDrag, PathEditDragStart, PathEditExtension } from 'features/paths/pathEditExtension';
import type { EditAnchorsDep } from '../depSchema';
import { makeEditAnchorsDep, stubDeps } from '../testUtils';
import { editAnchorsAction } from './action';

const NO_MODS = { alt: false, ctrl: false, meta: false, shift: false };

/** An open run of five anchors along +X, 10 apart. */
const line = (): PolygonPath => ({
  kind: 'polygon',
  commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_L]),
  coords: new Float32Array([0, 0, 10, 0, 20, 0, 30, 0, 40, 0]),
  fillRule: 'nonzero',
});

/** Anchor 0 at (0,0) with its out handle at (10,0); anchor 1 at (20,20). */
const curve = (): PolygonPath => ({
  kind: 'polygon',
  commands: new Uint8Array([PATH_M, PATH_C, PATH_Z]),
  coords: new Float32Array([0, 0, 10, 0, 20, 10, 20, 20]),
  fillRule: 'nonzero',
});

const ext = (id: string, drag: PathEditExtension['drag']): PathEditExtension => ({ id, drag });

function start(path: PolygonPath, part: string, at: { x: number; y: number }, extensions: PathEditExtension[]) {
  const committed: { path: PolygonPath | null } = { path: null };
  const dep: EditAnchorsDep = makeEditAnchorsDep({
    getStorageKind: () => 'pose',
    getNodeShape: () => null,
    getEditablePath: () => path,
    applyEdit: (_id, p) => { committed.path = p as PolygonPath; },
    extensions,
  });
  const affordance: AffordanceHit = { kind: part, targetIds: ['node-a'] };
  const ctx: InvocationCtx = {
    world: at,
    screen: at,
    modifiers: NO_MODS,
    deps: stubDeps({ selection: ['node-a'], editAnchors: dep }),
    drag: { start: at, current: at, delta: { x: 0, y: 0 }, affordance },
  };
  const invoker = editAnchorsAction.invoker;
  if (invoker?.timing !== 'ongoing') throw new Error('expected ongoing');
  const handle: OngoingHandle = invoker.start(ctx);
  const move = (world: { x: number; y: number }, modifiers = NO_MODS) => handle.onMove!({ ...ctx, world, modifiers });
  const wheel = (deltaY: number) => handle.onWheel?.({ ...ctx, wheel: { deltaX: 0, deltaY, deltaZ: 0 } });
  const end = () => {
    handle.onEnd!(ctx, 'commit');
    return pathToAnchors(committed.path!).anchors[0]!;
  };
  return { handle, move, wheel, end };
}

describe('editAnchors path-edit extension drags', () => {
  it('tells an extension what the press grabbed', () => {
    const drag = vi.fn((_start: PathEditDragStart) => null);
    start(line(), 'anchor:1', { x: 10, y: 0 }, [ext('a', drag)]);
    expect(drag).toHaveBeenCalledWith(expect.objectContaining({ id: 'node-a', part: 'anchor', anchorIndex: 1, dragging: [1] }));
  });

  it('moves the dragged anchors in full and weighted ones by the largest share given', () => {
    const drag = start(line(), 'anchor:0', { x: 0, y: 0 }, [
      ext('a', () => ({ weights: () => new Map([[1, 0.5], [2, 0.1]]) })),
      ext('b', () => ({ weights: () => new Map([[2, 0.25]]) })),
    ]);
    drag.move({ x: 0, y: 20 });
    expect(drag.end().map((p) => p.y)).toEqual([20, 10, 5, 0, 0]);
  });

  it('places a dragged handle through each extension in turn, after the locks', () => {
    const seen: { x: number; y: number }[] = [];
    const drag = start(curve(), 'controlOut:0', { x: 10, y: 0 }, [
      ext('a', () => ({ handle: (to) => { seen.push(to); return { x: to.x + 1, y: to.y }; } })),
      ext('b', () => ({ handle: (to, { locks }) => (locks.angle ? to : { x: to.x, y: to.y + 1 }) })),
    ]);
    drag.move({ x: 30, y: 12 }, { ...NO_MODS, shift: true });
    expect(seen).toEqual([{ x: 30, y: 0 }]);
    expect(drag.end()[0]!.outHandle).toEqual({ x: 31, y: 0 });
  });

  it('redoes the last move when an extension claims the wheel, and passes it on otherwise', () => {
    let share = 0;
    const wheel = vi.fn((_wheel: { deltaX: number; deltaY: number; deltaZ: number }) => { share = 1; return true; });
    const drag = start(line(), 'anchor:0', { x: 0, y: 0 }, [
      ext('a', () => ({ wheel: () => false })),
      ext('b', () => ({ weights: () => new Map([[1, share]]), wheel })),
    ]);
    drag.move({ x: 0, y: 20 });
    expect(drag.wheel(-100)).toBe(true);
    expect(wheel).toHaveBeenCalledWith({ deltaX: 0, deltaY: -100, deltaZ: 0 });
    expect(drag.end().map((p) => p.y)).toEqual([20, 20, 0, 0, 0]);
  });

  it('leaves the wheel to the bindings when no extension claims it', () => {
    const drag = start(line(), 'anchor:0', { x: 0, y: 0 }, []);
    drag.move({ x: 0, y: 20 });
    expect(drag.wheel(-100)).toBe(false);
  });

  it("draws the lock guide, then each extension's overlays on the moved path", () => {
    const mark: OngoingOverlay = { kind: 'polyline', points: [], role: 'falloff' };
    const overlays = vi.fn((_current: AnchorSet): OngoingOverlay[] => [mark]);
    const drag = start(curve(), 'controlOut:0', { x: 10, y: 0 }, [ext('a', (): PathEditDrag => ({ overlays }))]);
    drag.move({ x: 30, y: 12 }, { ...NO_MODS, shift: true });
    expect(overlaysOf(drag.handle)).toEqual([expect.objectContaining({ role: 'lock' }), mark]);
    expect(overlays.mock.calls[0]![0].anchors[0]![0]!.outHandle).toEqual({ x: 30, y: 0 });
  });
});
