import { describe, expect, it } from 'vitest';
import {
  anchorAt, anchorCount, anchorSymmetries, PathBuilder, pathFromD, pathToAnchors,
  type Affine, type AnchorSet, type PolygonPath,
} from '@weasel-js/geom';
import type { AffordanceHit, ImmediateInvoker, InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import { makeEditAnchorsDep, stubDeps } from '../testUtils';
import { editAnchorsAction } from './action';
import { nudgeAnchorsRightAction } from '../defaults/anchorEditing';

/** A kite symmetric about x = 50: top and bottom on the axis, wings either side. */
const kite = (): PolygonPath =>
  new PathBuilder().moveTo(50, 0).lineTo(80, 40).lineTo(50, 100).lineTo(20, 40).close().build();

function drag(
  path: PolygonPath,
  kind: string,
  from: { x: number; y: number },
  to: { x: number; y: number },
  transforms: readonly Affine[] | null,
): PolygonPath | null {
  let committed: PolygonPath | null = null;
  const dep = makeEditAnchorsDep({
    getEditablePath: () => path,
    applyEdit: (_id, next) => { committed = next as PolygonPath; },
  });
  const affordance: AffordanceHit = { kind, targetIds: ['node-a'] };
  const ctx: InvocationCtx = {
    world: from,
    screen: from,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: stubDeps({
      selection: ['node-a'],
      editAnchors: dep,
      ...(transforms ? { pathSymmetry: { transforms: () => transforms } } : {}),
    }),
    drag: { start: from, current: from, delta: { x: 0, y: 0 }, affordance },
  };
  const invoker = editAnchorsAction.invoker;
  if (invoker?.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
  const handle: OngoingHandle = invoker.start(ctx, undefined);
  // Pump events carry an empty dep bag, as the dispatcher sends them.
  const pump = { ...ctx, deps: {}, world: to };
  handle.onMove!(pump);
  handle.onEnd!(pump, 'commit');
  return committed;
}

const coords = (p: PolygonPath | null) => (p === null ? null : [...p.coords]);
const ACROSS_50: Affine = [-1, 0, 0, 1, 100, 0];

describe('editAnchorsAction with a pathSymmetry dep', () => {
  it('moves the image of a dragged anchor on a path symmetric under the transforms', () => {
    expect(coords(drag(kite(), 'anchor:1', { x: 80, y: 40 }, { x: 90, y: 30 }, [ACROSS_50])))
      .toEqual([50, 0, 90, 30, 50, 100, 10, 30]);
  });

  it('keeps an anchor on the axis on it', () => {
    expect(coords(drag(kite(), 'anchor:0', { x: 50, y: 0 }, { x: 60, y: -10 }, [ACROSS_50])))
      .toEqual([50, -10, 80, 40, 50, 100, 20, 40]);
  });

  it('moves one anchor alone on a path that is not its own image', () => {
    const lopsided = new PathBuilder().moveTo(50, 0).lineTo(80, 40).lineTo(50, 100).lineTo(25, 40).close().build();
    expect(coords(drag(lopsided, 'anchor:1', { x: 80, y: 40 }, { x: 90, y: 30 }, [ACROSS_50])))
      .toEqual([50, 0, 90, 30, 50, 100, 25, 40]);
  });

  it('moves one anchor alone without the dep', () => {
    expect(coords(drag(kite(), 'anchor:1', { x: 80, y: 40 }, { x: 90, y: 30 }, null)))
      .toEqual([50, 0, 90, 30, 50, 100, 20, 40]);
  });
});

describe('nudging anchors with a pathSymmetry dep', () => {
  it('moves the image of a nudged anchor too', () => {
    let committed: PolygonPath | null = null;
    const dep = makeEditAnchorsDep({
      getEditablePath: () => kite(),
      applyEdit: (_id, next) => { committed = next as PolygonPath; },
      selectedAnchors: new Set([1]),
    });
    const invoker = nudgeAnchorsRightAction.invoker as ImmediateInvoker;
    invoker.run(stubDeps({ editAnchors: dep, pathSymmetry: { transforms: () => [ACROSS_50] } }), { magnitude: 'small' });
    const [, , x1, , , , x3] = coords(committed)!;
    expect(x1).toBeGreaterThan(80);
    expect(x1 + x3).toBeCloseTo(100);
  });
});

/** The previous lab's seed: a curved kite, symmetric about x = 300, its last curve closing on the first point. */
const LAB_KITE = 'M300 60 C340 90 380 130 380 160 L300 330 L220 160 C220 130 260 90 300 60 Z';
/** Both axes through (300, 200): the kite is its own image under the vertical mirror only. */
const BOTH: Affine[] = [[-1, 0, 0, 1, 600, 0], [1, 0, 0, -1, 0, 400], [-1, 0, 0, -1, 600, 400]];

describe('the previous lab\'s kite under both axes', () => {
  const path = pathFromD(LAB_KITE) as PolygonPath;
  const set = pathToAnchors(path) as AnchorSet;
  const held = anchorSymmetries(set, BOTH, 1e-3).length;

  it('is its own image under one of the three transforms', () => {
    expect(held).toBe(1);
  });

  it('stays its own image when any anchor or handle is dragged', () => {
    for (let i = 0; i < anchorCount(set); i++) {
      const a = anchorAt(set, i)!;
      const parts: Array<[string, { x: number; y: number }]> = [[`anchor:${i}`, a]];
      if (a.inHandle) parts.push([`controlIn:${i}`, a.inHandle]);
      if (a.outHandle) parts.push([`controlOut:${i}`, a.outHandle]);
      for (const [kind, at] of parts) {
        const out = drag(path, kind, at, { x: at.x + 13, y: at.y - 7 }, BOTH);
        expect(out, kind).not.toBeNull();
        expect(anchorSymmetries(pathToAnchors(out!) as AnchorSet, BOTH, 1e-3), kind).toHaveLength(held);
      }
    }
  });
});
