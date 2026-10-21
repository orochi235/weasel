import { describe, expect, it } from 'vitest';
import type { ActionDeps, AffordanceHit, ImmediateInvoker, InvocationCtx } from '@weasel-js/routing';
import { cornerAt, cornerSpecAt, polygonFromPoints, resolveCorners, withCorner, type PolygonPath } from '@weasel-js/geom';
import type { EditAnchorsDep } from '@weasel-js/core';
import { makeEditAnchorsDepForTests as makeEditAnchorsDep } from '@weasel-js/core/test-seams';
import { editCornerAction } from './editCorner';
import { cycleCornerShapeAction, DEFAULT_CORNER_TRIM_SHARE, setCornersAction } from './cornerCommands';

const stubDeps = (deps: Record<string, unknown>) => deps as ActionDeps;

const square = (): PolygonPath =>
  polygonFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]);

function dragCtx(dep: EditAnchorsDep, kind: string, world: { x: number; y: number }): InvocationCtx {
  const affordance: AffordanceHit = { kind, targetIds: ['node-a'] };
  return {
    world,
    screen: world,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: stubDeps({ selection: ['node-a'], editAnchors: dep }),
    drag: { start: world, current: world, delta: { x: 0, y: 0 }, affordance },
  };
}

function editing(path: PolygonPath, selected: number[] = []) {
  const edits: PolygonPath[] = [];
  const dep = makeEditAnchorsDep({
    getEditablePath: () => path,
    applyEdit: (_id, p) => { edits.push(p as PolygonPath); },
  });
  dep.setSelectedAnchors(selected);
  return { dep, edits };
}

function start(dep: EditAnchorsDep, kind: string, at: { x: number; y: number }) {
  const invoker = editCornerAction.invoker;
  if (invoker?.timing !== 'ongoing') throw new Error('expected ongoing');
  const ctx = dragCtx(dep, kind, at);
  return { handle: invoker.start(ctx, undefined), ctx };
}

describe('editCornerAction', () => {
  it('matches only corner-widget affordances', () => {
    const [{ spec: binding }] = editCornerAction.defaultBinding as [{ spec: { target: { kindOf: (h: unknown) => boolean } } }];
    expect(binding.target.kindOf({ kind: 'corner:2' })).toBe(true);
    expect(binding.target.kindOf({ kind: 'anchor:2' })).toBe(false);
  });

  it('turns a drag along the bisector into a round radius, committed once', () => {
    const { dep, edits } = editing(square());
    // Anchor 1 is (100, 0); its bisector points to (-1, 1) / sqrt 2.
    const { handle, ctx } = start(dep, 'corner:1', { x: 90, y: 10 });
    const s = Math.SQRT1_2 * 10;
    handle.onMove!({ ...ctx, world: { x: 90 - s, y: 10 + s } });
    expect(handle.previewIds!()).toEqual(['node-a']);
    handle.onMove!({ ...ctx, world: { x: 90 - 2 * s, y: 10 + 2 * s } });
    expect(edits).toHaveLength(0);
    handle.onEnd!(ctx, 'commit');
    expect(edits).toHaveLength(1);
    const corner = cornerAt(edits[0], 1)!;
    expect(corner.shape).toBe('round');
    // 20 along the bisector of a right angle cuts 20 / cos 45° along each edge.
    expect(corner.radius).toBeCloseTo(20 / Math.SQRT1_2, 4);
  });

  it('clamps the radius to the room the edges leave', () => {
    const { dep, edits } = editing(square());
    const { handle, ctx } = start(dep, 'corner:1', { x: 90, y: 10 });
    handle.onMove!({ ...ctx, world: { x: -500, y: 600 } });
    handle.onEnd!(ctx, 'commit');
    expect(cornerAt(edits[0], 1)!.radius).toBeCloseTo(100, 4);
  });

  it('gives every selected corner the radius when a selected widget is pressed', () => {
    const { dep, edits } = editing(square(), [1, 2]);
    const { handle, ctx } = start(dep, 'corner:1', { x: 90, y: 10 });
    handle.onMove!({ ...ctx, world: { x: 80, y: 20 } });
    handle.onEnd!(ctx, 'commit');
    expect(cornerAt(edits[0], 1)!.radius).toBeCloseTo(cornerAt(edits[0], 2)!.radius, 6);
    expect(cornerAt(edits[0], 0)).toBeNull();
  });

  it('commits nothing on cancel', () => {
    const { dep, edits } = editing(square());
    const { handle, ctx } = start(dep, 'corner:1', { x: 90, y: 10 });
    handle.onMove!({ ...ctx, world: { x: 80, y: 20 } });
    handle.onEnd!(ctx, 'cancel');
    expect(edits).toHaveLength(0);
  });
});

describe('cycleCornerShapeAction', () => {
  const run = (dep: EditAnchorsDep) =>
    (cycleCornerShapeAction.invoker as ImmediateInvoker).run(stubDeps({ editAnchors: dep }), undefined);

  it('steps the selected corners to the next keyword and keeps their radius', () => {
    const path = withCorner(square(), 1, { shape: 'round', radius: 10 });
    const { dep, edits } = editing(path, [1]);
    run(dep);
    const spec = cornerSpecAt(edits[0], 1)!;
    expect(spec.shape).toBe('bevel');
    expect(spec.radius).toBeCloseTo(10, 9);
  });

  it('gives a bare corner the keyword after round and a radius that shows it', () => {
    const { dep, edits } = editing(square(), [3]);
    run(dep);
    expect(cornerSpecAt(edits[0], 3)?.shape).toBe('bevel');
    expect(cornerSpecAt(edits[0], 3)?.radius).toBeCloseTo(DEFAULT_CORNER_TRIM_SHARE * 100, 6);
    expect(resolveCorners(edits[0]).coords.length).toBeGreaterThan(square().coords.length);
  });

  it('is disabled with no corner anchor selected', () => {
    const { dep } = editing(square());
    expect(cycleCornerShapeAction.enabled!(stubDeps({ editAnchors: dep }))).not.toBe(true);
  });
});

describe('setCornersAction', () => {
  const run = (dep: EditAnchorsDep, params: Record<string, unknown>) =>
    (setCornersAction.invoker as ImmediateInvoker).run(stubDeps({ editAnchors: dep }), params);

  it('sets the shape and radius of the selected corners, clamped to their room', () => {
    const { dep, edits } = editing(square(), [0, 2]);
    run(dep, { shape: 'scoop', radius: 500 });
    expect(cornerSpecAt(edits[0], 0)).toEqual({ shape: 'scoop', radius: 100 });
    expect(cornerSpecAt(edits[0], 2)).toEqual({ shape: 'scoop', radius: 100 });
    expect(cornerSpecAt(edits[0], 1)).toBeNull();
  });

  it('gives a bare corner a visible radius with its shape, unless the call names one', () => {
    const { dep, edits } = editing(square(), [1]);
    run(dep, { shape: 'scoop' });
    expect(cornerSpecAt(edits[0], 1)?.radius).toBeGreaterThan(0);
    run(dep, { shape: 'bevel', radius: 7 });
    expect(cornerSpecAt(edits[1], 1)).toEqual({ shape: 'bevel', radius: 7 });
  });

  it('takes a superellipse parameter as the shape, and refuses one that is not finite', () => {
    const { dep, edits } = editing(withCorner(square(), 1, { shape: 'round', radius: 5 }), [1]);
    run(dep, { shape: 1.5 });
    expect(cornerSpecAt(edits[0], 1)).toEqual({ shape: 1.5, radius: 5 });
    run(dep, { shape: Infinity });
    expect(edits).toHaveLength(1);
  });

  it('keeps the shape when only a radius is given', () => {
    const { dep, edits } = editing(withCorner(square(), 1, { shape: 'bevel', radius: 5 }), [1]);
    run(dep, { radius: 12 });
    expect(cornerSpecAt(edits[0], 1)).toEqual({ shape: 'bevel', radius: 12 });
  });
});
