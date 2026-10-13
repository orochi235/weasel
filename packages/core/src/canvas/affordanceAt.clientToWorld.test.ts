/**
 * `buildAffordanceAt` hit-tests correctly at non-unit
 * scale and non-zero pan, fed through a local copy of the client → world
 * conversion.
 */

import { describe, it, expect } from 'vitest';
import { buildAffordanceAt, type AnchorState } from './affordanceAt';
import { PATH_M, PATH_L, PATH_C, PATH_Z, type PolygonPath } from '@weasel-js/geom';

function clientToWorld(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number },
  view: { x: number; y: number; scale: { x: number; y: number } },
): { x: number; y: number } {
  return {
    x: (clientX - rect.left) / view.scale.x + view.x,
    y: (clientY - rect.top) / view.scale.y + view.y,
  };
}

/** Identity view — hit radii are screen px, so scale 1 makes them world px. */
const UNIT_VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

describe('buildAffordanceAt at scale=2 with non-zero pan (T7 audit)', () => {
  const view = { x: 0, y: 0, scale: { x: 2, y: 2 } };
  const rect = { left: 0, top: 0 };

  const chromeState = {
    selection: ['node-1'],
    multiActive: false,
    boundsOf: (id: string) => id === 'node-1'
      ? { x: 20, y: 20, width: 40, height: 40 }
      : null,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    get unionBounds() { return null; },
  };

  const affordanceAt = buildAffordanceAt({ getChromeState: () => chromeState as any, getView: () => view });

  it('client (40, 40) at scale=2 → world (20,20) → top-left handle hit', () => {
    const wp = clientToWorld(40, 40, rect, view);
    const hit = affordanceAt(wp);
    expect(hit).not.toBeNull();
    expect(hit?.kind).toBe('handle:top-left');
    // anchor is populated for handle:* hits. top-left dragged →
    // bottom-right fixed → { x:'max', y:'max' }.
    expect(hit?.anchor).toEqual({ x: 'max', y: 'max' });
  });

  it('client (200, 200) at scale=2 → world (100,100) → no handle hit', () => {
    const wp = clientToWorld(200, 200, rect, view);
    const hit = affordanceAt(wp);
    expect(hit).toBeNull();
  });

  it('with pan=(10,5): client (60,45) → world (25+10=35?, 22.5+5=27.5) — verify formula', () => {
    const pannedView = { x: 10, y: 5, scale: { x: 2, y: 2 } };
    const wp = clientToWorld(60, 45, rect, pannedView);
    expect(wp.x).toBeCloseTo(40);
    expect(wp.y).toBeCloseTo(27.5);
    // World (40, 27.5) is inside node (20,20,40,40) → not a corner hit (far from corners).
    const pannedChrome = {
      selection: ['node-1'],
      multiActive: false,
      boundsOf: (id: string) => id === 'node-1'
        ? { x: 20, y: 20, width: 40, height: 40 }
        : null,
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      get unionBounds() { return null; },
    };
    const pannedAffordanceAt = buildAffordanceAt({ getChromeState: () => pannedChrome as any, getView: () => pannedView });
    const hit = pannedAffordanceAt(wp);
    // Not near any corner (corner at (20,20), distance from (40,27.5) ≈ 22 > 8).
    expect(hit).toBeNull();
  });

  it('with pan=(10,5): top-left handle at world (20,20) → client (20, 30)', () => {
    // worldX=20 → screenX = (worldX - view.x) * scale.x = (20-10)*2 = 20 → clientX=20+rect.left=20
    // worldY=20 → screenY = (worldY - view.y) * scale.y = (20-5)*2 = 30 → clientY=30+rect.top=30
    const pannedView = { x: 10, y: 5, scale: { x: 2, y: 2 } };
    const wp = clientToWorld(20, 30, rect, pannedView);
    expect(wp.x).toBeCloseTo(20);
    expect(wp.y).toBeCloseTo(20);
    const pannedChrome = {
      selection: ['node-1'],
      multiActive: false,
      boundsOf: (id: string) => id === 'node-1'
        ? { x: 20, y: 20, width: 40, height: 40 }
        : null,
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      get unionBounds() { return null; },
    };
    const pannedAffordanceAt = buildAffordanceAt({ getChromeState: () => pannedChrome as any, getView: () => pannedView });
    const hit = pannedAffordanceAt(wp);
    expect(hit).not.toBeNull();
    expect(hit?.kind).toBe('handle:top-left');
  });
});

/** Build a simple triangle PolygonPath: M(0,0) L(10,0) L(5,10) Z
 *  Anchors: index 0 at (0,0), index 1 at (10,0), index 2 at (5,10). */
function makeTriangle(): PolygonPath {
  return {
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_Z]),
    coords: new Float32Array([0, 0, 10, 0, 5, 10]),
    fillRule: 'nonzero',
  };
}

/** A two-point bezier path: anchor 0 at (0,0) with controlOut at (5,-5),
 *  anchor 1 at (10,10) with controlIn at (5,15). */
function makeBezierPath(): PolygonPath {
  return {
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_C, PATH_Z]),
    // M  (0,0)   C  cp1(5,-5)  cp2(5,15)  ep(10,10)
    coords: new Float32Array([0, 0, 5, -5, 5, 15, 10, 10]),
    fillRule: 'nonzero',
  };
}

/** Shared chrome state with one selected path node. */
function makeChromeState(nodeId = 'path-1') {
  return {
    selection: [nodeId] as string[],
    multiActive: false,
    boundsOf: () => null,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    get unionBounds() { return null; },
  };
}

describe('buildAffordanceAt — anchor hits on selected polygon paths', () => {
  const triangle = makeTriangle();
  const chromeState = makeChromeState();
  // Node 'path-1' is selected and is a triangle polygon.
  const anchorState: AnchorState = {
    editingId: null, // not in edit mode — only anchor points hittable
    getPose: (id) => id === 'path-1' ? triangle : undefined,
  };

  const affordanceAt = buildAffordanceAt({
    getChromeState: () => chromeState as any,
    getView: () => UNIT_VIEW,
    getAnchorState: () => anchorState,
  });

  it('pointer near anchor 0 (0,0) returns anchor:0', () => {
    const hit = affordanceAt({ x: 0, y: 0 });
    expect(hit).not.toBeNull();
    expect(hit?.kind).toBe('anchor:0');
    expect(hit?.targetIds).toEqual(['path-1']);
  });

  it('pointer near anchor 1 (10,0) returns anchor:1', () => {
    const hit = affordanceAt({ x: 10, y: 0 });
    expect(hit).not.toBeNull();
    expect(hit?.kind).toBe('anchor:1');
  });

  it('pointer near anchor 2 (5,10) returns anchor:2', () => {
    const hit = affordanceAt({ x: 5, y: 10 });
    expect(hit).not.toBeNull();
    expect(hit?.kind).toBe('anchor:2');
  });

  it('pointer far from all anchors returns null', () => {
    const hit = affordanceAt({ x: 100, y: 100 });
    expect(hit).toBeNull();
  });

  it('a second selected path yields no anchor hits while another path is edited', () => {
    const other = makeTriangle();
    const twoSelected = {
      ...makeChromeState(),
      selection: ['path-1', 'path-2'] as string[],
    };
    const editingPath1: AnchorState = {
      editingId: 'path-1',
      // 'path-2' is the same triangle shifted 100 to the right.
      getPose: (id) => {
        if (id === 'path-1') return triangle;
        if (id !== 'path-2') return undefined;
        return { ...other, coords: new Float32Array([100, 0, 110, 0, 105, 10]) };
      },
    };
    const afAt = buildAffordanceAt({
      getChromeState: () => twoSelected as any,
      getView: () => UNIT_VIEW,
      getAnchorState: () => editingPath1,
    });

    expect(afAt({ x: 0, y: 0 })?.kind).toBe('anchor:0');
    // Right on path-2's first anchor: nothing, because dragging it would have
    // edited path-1's anchor 0.
    expect(afAt({ x: 100, y: 0 })).toBeNull();
  });

  it('control handles NOT hittable when not in edit mode', () => {
    const bezier = makeBezierPath();
    const noEditAnchorState: AnchorState = {
      editingId: null,
      getPose: (id) => id === 'path-1' ? bezier : undefined,
    };
    const afAt = buildAffordanceAt({
      getChromeState: () => makeChromeState() as any,
      getView: () => UNIT_VIEW,
      getAnchorState: () => noEditAnchorState,
    });
    // (5,-5) is anchor 0's controlOut, and ≈ 7.07 < 8 from anchor 0 itself,
    // so outside edit mode anchor:0 takes the hit.
    const hit = afAt({ x: 5, y: -5 });
    expect(hit?.kind).toBe('anchor:0');
  });
});

describe('buildAffordanceAt — control-handle hits when in edit mode', () => {
  const bezier = makeBezierPath();
  const chromeState = makeChromeState();
  // 'path-1' is in edit mode.
  const anchorState: AnchorState = {
    editingId: 'path-1',
    getPose: (id) => id === 'path-1' ? bezier : undefined,
  };

  const affordanceAt = buildAffordanceAt({
    getChromeState: () => chromeState as any,
    getView: () => UNIT_VIEW,
    getAnchorState: () => anchorState,
  });

  it('pointer near controlOut of anchor 0 (5,-5) returns controlOut:0', () => {
    // anchor 0 controlOut at (5,-5); anchor 0 at (0,0).
    // Controls are preferred over anchors when both are within radius.
    const hit = affordanceAt({ x: 5, y: -5 });
    expect(hit).not.toBeNull();
    expect(hit?.kind).toBe('controlOut:0');
    expect(hit?.targetIds).toEqual(['path-1']);
  });

  it('pointer near controlIn of anchor 1 (5,15) returns controlIn:1', () => {
    const hit = affordanceAt({ x: 5, y: 15 });
    expect(hit).not.toBeNull();
    expect(hit?.kind).toBe('controlIn:1');
  });

  it('pointer near anchor 1 (10,10) when not near any control returns anchor:1', () => {
    // Controls win over anchors, and anchor 1's controlIn (5,15) is within
    // radius of the anchor itself. (15,5) is ≈ 7.07 from the anchor and ≈ 14
    // from the control, so only the anchor is in range.
    const hit = affordanceAt({ x: 15, y: 5 });
    expect(hit).not.toBeNull();
    expect(hit?.kind).toBe('anchor:1');
  });

  it('pointer far from everything returns null', () => {
    const hit = affordanceAt({ x: 200, y: 200 });
    expect(hit).toBeNull();
  });
});

describe('buildAffordanceAt — no anchor state wired → no anchor hits', () => {
  const chromeState = makeChromeState();

  // No getAnchorState passed → anchors never hittable.
  const affordanceAt = buildAffordanceAt({
    getChromeState: () => chromeState as any,
    getView: () => UNIT_VIEW,
  });

  it('pointer exactly on anchor 0 returns null (no anchor classifier wired)', () => {
    // Without getAnchorState, the classifier ignores path poses.
    const hit = affordanceAt({ x: 0, y: 0 });
    expect(hit).toBeNull();
  });
});

describe('buildAffordanceAt — non-polygon pose is skipped', () => {
  const chromeState = makeChromeState();
  const anchorState: AnchorState = {
    editingId: null,
    getPose: () => ({ kind: 'rect', x: 0, y: 0, width: 100, height: 100 }),
  };

  const affordanceAt = buildAffordanceAt({
    getChromeState: () => chromeState as any,
    getView: () => UNIT_VIEW,
    getAnchorState: () => anchorState,
  });

  it('rect pose returns null (not hittable as anchor)', () => {
    const hit = affordanceAt({ x: 0, y: 0 });
    expect(hit).toBeNull();
  });
});
