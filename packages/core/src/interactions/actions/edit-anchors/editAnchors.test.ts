import { describe, it, expect } from 'vitest';
import { editAnchorsAction } from './action';
import type { InvocationCtx, AffordanceHit } from '@weasel-js/routing';
import type { EditAnchorsDep } from '../depSchema';
import { makeEditAnchorsDep, stubDeps } from '../testUtils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(
  dep?: EditAnchorsDep,
  affordance?: AffordanceHit,
): InvocationCtx {
  return {
    world: { x: 5, y: 5 },
    screen: { x: 5, y: 5 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: stubDeps(dep ? { selection: ['node-a'], editAnchors: dep } : { selection: ['node-a'] }),
    drag: {
      start: { x: 5, y: 5 },
      current: { x: 5, y: 5 },
      delta: { x: 0, y: 0 },
      ...(affordance ? { affordance } : {}),
    },
  };
}

function getOngoingInvoker(action: typeof editAnchorsAction) {
  if (!action.invoker || action.invoker.timing !== 'ongoing') {
    throw new Error('Expected ongoing invoker');
  }
  return action.invoker;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('editAnchorsAction descriptor', () => {
  it('declares id, label, drag defaultBinding, and ongoing timing', () => {
    expect(editAnchorsAction.id).toBe('editAnchors');
    expect(editAnchorsAction.label).toBe('Edit Anchors');
    // Binding is a drag with a target predicate filtering for anchor-kind
    // affordances (`anchor:N` / `controlIn:N` / `controlOut:N`). The predicate
    // function identity is opaque to the equality check; verify shape + behavior.
    const [bound] = editAnchorsAction.defaultBinding as [{ spec: { kind: string; target: { kindOf: (h: unknown) => boolean } }; opts: { id: string } }];
    expect(bound.opts.id).toBe('editAnchors.drag');
    const binding = bound.spec;
    expect(binding.kind).toBe('drag');
    expect(typeof binding.target.kindOf).toBe('function');
    expect(binding.target.kindOf({ kind: 'anchor:0' })).toBe(true);
    expect(binding.target.kindOf({ kind: 'controlOut:3' })).toBe(true);
    expect(binding.target.kindOf({ kind: 'handle:top-left' })).toBe(false);
    expect(binding.target.kindOf(undefined)).toBe(false);
    expect(editAnchorsAction.invoker?.timing).toBe('ongoing');
  });

  it('requires selection dep', () => {
    expect(editAnchorsAction.requires).toContain('selection');
  });

  it('requires editAnchors dep', () => {
    expect(editAnchorsAction.requires).toContain('editAnchors');
  });

  it("enabled returns true (invoker self-guards on empty selection)", () => {
    expect(editAnchorsAction.enabled!()).toBe(true);
  });

  it('start returns empty handle when editAnchors dep is absent', () => {
    const invoker = getOngoingInvoker(editAnchorsAction);
    const emptyCtx: InvocationCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {},
    };
    const handle = invoker.start(emptyCtx, undefined);
    expect(handle).toEqual({});
  });

  it('start returns empty handle when no affordance is hit (open canvas drag)', () => {
    const invoker = getOngoingInvoker(editAnchorsAction);
    const dep: EditAnchorsDep = makeEditAnchorsDep({
      getStorageKind: () => 'pose',
      getNodeShape: () => null,
      getEditablePath: () => ({ kind: 'polygon', coords: [0, 0, 10, 0, 10, 10] }),
      applyEdit: () => {},
    });
    // No affordance in drag → should return {}
    const handle = invoker.start(makeCtx(dep, undefined), undefined);
    expect(handle).toEqual({});
  });

  it('start returns empty handle when affordance is non-anchor (e.g. resize handle)', () => {
    const invoker = getOngoingInvoker(editAnchorsAction);
    const dep: EditAnchorsDep = makeEditAnchorsDep({
      getStorageKind: () => 'pose',
      getNodeShape: () => null,
      getEditablePath: () => ({ kind: 'polygon', coords: [0, 0, 10, 0, 10, 10] }),
      applyEdit: () => {},
    });
    const resizeAffordance: AffordanceHit = { kind: 'handle:bottom-right' };
    const handle = invoker.start(makeCtx(dep, resizeAffordance), undefined);
    expect(handle).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Happy-path tests — anchors (REAL invoker)
// ---------------------------------------------------------------------------

import { PATH_M, PATH_L, PATH_C, PATH_Z, pathToAnchors, type PolygonPath } from '@weasel-js/geom';

/** M(0,0) L(10,0) L(5,10) Z — three anchors at (0,0), (10,0), (5,10). */
function makeTriangle(): PolygonPath {
  return {
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_Z]),
    coords: new Float32Array([0, 0, 10, 0, 5, 10]),
    fillRule: 'nonzero',
  };
}

/** M(0,0) C(5,-5, 5,15, 10,10) Z — anchor 0 at (0,0), anchor 1 at (10,10).
 *  controlOut[0] at (5,-5), controlIn[1] at (5,15). */
function makeBezierPath(): PolygonPath {
  return {
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_C, PATH_Z]),
    coords: new Float32Array([0, 0, 5, -5, 5, 15, 10, 10]),
    fillRule: 'nonzero',
  };
}

describe('editAnchorsAction — REAL invoker (anchors)', () => {
  const invoker = getOngoingInvoker(editAnchorsAction);

  it('onEnd commit dispatches applyEdit (pose changed)', () => {
    const triangle = makeTriangle();
    let applyEditCount = 0;
    const dep: EditAnchorsDep = makeEditAnchorsDep({
      getStorageKind: () => 'pose',
      getNodeShape: () => null,
      getEditablePath: () => triangle,
      applyEdit: () => { applyEditCount++; },
    });
    const affordance: AffordanceHit = { kind: 'anchor:0', targetIds: ['node-a'] };
    const startCtx: InvocationCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: stubDeps({ selection: ['node-a'], editAnchors: dep }),
      drag: { start: { x: 0, y: 0 }, current: { x: 0, y: 0 }, delta: { x: 0, y: 0 }, affordance },
    };
    const handle = invoker.start(startCtx, undefined);

    // Move anchor 0 to (99, 99).
    handle.onMove!({
      ...startCtx,
      world: { x: 99, y: 99 },
      drag: { ...startCtx.drag!, current: { x: 99, y: 99 }, delta: { x: 99, y: 99 } },
    });

    handle.onEnd!(startCtx, 'commit');
    expect(applyEditCount).toBeGreaterThan(0);
  });

  it('onEnd cancel does not dispatch applyEdit', () => {
    const triangle = makeTriangle();
    let opsDispatched = false;
    const dep: EditAnchorsDep = makeEditAnchorsDep({
      getStorageKind: () => 'pose',
      getNodeShape: () => null,
      getEditablePath: () => triangle,
      applyEdit: () => { opsDispatched = true; },
    });
    const affordance: AffordanceHit = { kind: 'anchor:0', targetIds: ['node-a'] };
    const startCtx: InvocationCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: stubDeps({ selection: ['node-a'], editAnchors: dep }),
      drag: { start: { x: 0, y: 0 }, current: { x: 0, y: 0 }, delta: { x: 0, y: 0 }, affordance },
    };
    const handle = invoker.start(startCtx, undefined);
    handle.onMove!({ ...startCtx, world: { x: 50, y: 50 }, drag: { ...startCtx.drag!, current: { x: 50, y: 50 }, delta: { x: 50, y: 50 } } });
    handle.onEnd!(startCtx, 'cancel');
    expect(opsDispatched).toBe(false);
  });

  it('start returns active handle for controlIn:1 when bezier pose', () => {
    const bezier = makeBezierPath();
    const dep: EditAnchorsDep = makeEditAnchorsDep({
      getStorageKind: () => 'pose',
      getNodeShape: () => null,
      getEditablePath: () => bezier,
      applyEdit: () => {},
    });
    const affordance: AffordanceHit = { kind: 'controlIn:1', targetIds: ['node-a'] };
    const ctx: InvocationCtx = {
      world: { x: 5, y: 15 },
      screen: { x: 5, y: 15 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: stubDeps({ selection: ['node-a'], editAnchors: dep }),
      drag: { start: { x: 5, y: 15 }, current: { x: 5, y: 15 }, delta: { x: 0, y: 0 }, affordance },
    };
    const handle = invoker.start(ctx, undefined);
    expect(handle).toHaveProperty('onMove');
    expect(handle).toHaveProperty('onEnd');
  });

  it('Shift holds a dragged handle to its angle, changing only its length', () => {
    const bezier = makeBezierPath();
    let committed: PolygonPath | null = null;
    const dep: EditAnchorsDep = makeEditAnchorsDep({
      getStorageKind: () => 'pose',
      getNodeShape: () => null,
      getEditablePath: () => bezier,
      applyEdit: (_id, path) => { committed = path as PolygonPath; },
    });
    const affordance: AffordanceHit = { kind: 'controlOut:0', targetIds: ['node-a'] };
    const startCtx: InvocationCtx = {
      world: { x: 5, y: -5 },
      screen: { x: 5, y: -5 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: stubDeps({ selection: ['node-a'], editAnchors: dep }),
      drag: { start: { x: 5, y: -5 }, current: { x: 5, y: -5 }, delta: { x: 0, y: 0 }, affordance },
    };
    const handle = invoker.start(startCtx, undefined);
    handle.onMove!({
      ...startCtx,
      world: { x: 20, y: -10 },
      modifiers: { ...startCtx.modifiers, shift: true },
    });
    handle.onEnd!(startCtx, 'commit');
    // The handle ran from (0,0) toward (1,-1); (20,-10) projects onto that line at (15,-15).
    const out = pathToAnchors(committed!).anchors[0][0].outHandle!;
    expect(out.x).toBeCloseTo(15, 4);
    expect(out.y).toBeCloseTo(-15, 4);
  });

  it('previewIds + previewPose surface the in-flight polygon; cleared after onEnd', () => {
    const triangle = makeTriangle();
    const dep: EditAnchorsDep = makeEditAnchorsDep({
      getStorageKind: () => 'pose',
      getNodeShape: () => null,
      getEditablePath: () => triangle,
      applyEdit: () => {},
    });
    const affordance: AffordanceHit = { kind: 'anchor:0', targetIds: ['node-a'] };
    const startCtx: InvocationCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: stubDeps({ selection: ['node-a'], editAnchors: dep }),
      drag: { start: { x: 0, y: 0 }, current: { x: 0, y: 0 }, delta: { x: 0, y: 0 }, affordance },
    };
    const handle = invoker.start(startCtx, undefined);
    // Before any move: not yet active.
    expect(handle.previewIds!()).toBeNull();
    handle.onMove!({
      ...startCtx,
      world: { x: 7, y: 8 },
      drag: { ...startCtx.drag!, current: { x: 7, y: 8 }, delta: { x: 7, y: 8 } },
    });
    expect(Array.from(handle.previewIds!() ?? [])).toEqual(['node-a']);
    // Pose-as-polygon: previewPose is the polygon itself.
    const previewPose = handle.previewPose!('node-a') as PolygonPath;
    expect(previewPose.coords[0]).toBeCloseTo(7);
    expect(previewPose.coords[1]).toBeCloseTo(8);
    // Pose-as-polygon doesn't emit previewData.
    expect(handle.previewData!('node-a')).toBeNull();
    handle.onEnd!(startCtx, 'commit');
    expect(handle.previewIds!()).toBeNull();
  });

  it('start returns empty handle when anchor index is out of range', () => {
    const triangle = makeTriangle(); // only 3 anchors (0,1,2)
    const dep: EditAnchorsDep = makeEditAnchorsDep({
      getStorageKind: () => 'pose',
      getNodeShape: () => null,
      getEditablePath: () => triangle,
      applyEdit: () => {},
    });
    const affordance: AffordanceHit = { kind: 'anchor:99', targetIds: ['node-a'] };
    const ctx: InvocationCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: stubDeps({ selection: ['node-a'], editAnchors: dep }),
      drag: { start: { x: 0, y: 0 }, current: { x: 0, y: 0 }, delta: { x: 0, y: 0 }, affordance },
    };
    const handle = invoker.start(ctx, undefined);
    expect(handle).toEqual({});
  });
});
