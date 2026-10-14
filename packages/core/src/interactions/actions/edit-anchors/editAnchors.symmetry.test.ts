import { describe, it, expect } from 'vitest';
import { PathBuilder, type PolygonPath } from '@weasel-js/geom';
import type { AffordanceHit, InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import type { Symmetry } from 'features/symmetry';
import { makeEditAnchorsDep, stubDeps } from '../testUtils';
import { editAnchorsAction } from './action';

/** A kite symmetric about x = 50: top and bottom on the axis, wings either side. */
const kite = (): PolygonPath =>
  new PathBuilder().moveTo(50, 0).lineTo(80, 40).lineTo(50, 100).lineTo(20, 40).close().build();

function drag(path: PolygonPath, kind: string, from: { x: number; y: number }, to: { x: number; y: number }, symmetry: Symmetry | null) {
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
    deps: stubDeps({ selection: ['node-a'], editAnchors: dep, symmetry: { get: () => symmetry, set: () => {} } }),
    drag: { start: from, current: from, delta: { x: 0, y: 0 }, affordance },
  };
  const invoker = editAnchorsAction.invoker;
  if (invoker?.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
  const handle: OngoingHandle = invoker.start(ctx, undefined);
  // Pump events carry an empty dep bag, as the dispatcher sends them.
  const pump = { ...ctx, deps: {}, world: to };
  handle.onMove!(pump);
  handle.onEnd!(pump, 'commit');
  return committed === null ? null : [...(committed as PolygonPath).coords];
}

const ACROSS_50: Symmetry = { axis: 'vertical', center: { x: 50, y: 0 } };

describe('editAnchorsAction under symmetry', () => {
  it('declares the symmetry dep', () => {
    expect(editAnchorsAction.requires).toContain('symmetry');
  });

  it('moves the mirror partner of a dragged anchor on a self-symmetric path', () => {
    expect(drag(kite(), 'anchor:1', { x: 80, y: 40 }, { x: 90, y: 30 }, ACROSS_50))
      .toEqual([50, 0, 90, 30, 50, 100, 10, 30]);
  });

  it('keeps an anchor on the axis on it', () => {
    expect(drag(kite(), 'anchor:0', { x: 50, y: 0 }, { x: 60, y: -10 }, ACROSS_50))
      .toEqual([50, -10, 80, 40, 50, 100, 20, 40]);
  });

  it('moves one anchor alone on a path that is not its own mirror image', () => {
    const lopsided = new PathBuilder().moveTo(50, 0).lineTo(80, 40).lineTo(50, 100).lineTo(25, 40).close().build();
    expect(drag(lopsided, 'anchor:1', { x: 80, y: 40 }, { x: 90, y: 30 }, ACROSS_50))
      .toEqual([50, 0, 90, 30, 50, 100, 25, 40]);
  });

  it('moves one anchor alone while symmetry is off', () => {
    expect(drag(kite(), 'anchor:1', { x: 80, y: 40 }, { x: 90, y: 30 }, null))
      .toEqual([50, 0, 90, 30, 50, 100, 20, 40]);
  });
});
