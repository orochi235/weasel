/**
 * affordanceAt + clientToWorld regression.
 *
 * A prior audit flagged: "correct at scale=1/view.x=0; non-unit-scale needs audit."
 *
 * This suite exercises the `clientToWorld` formula used in `GestureDispatcherMounter`
 * and verifies that `buildAffordanceAt` / `buildClassifyTarget` hit-test correctly at:
 *   - scale=1, pan=(0,0)  — baseline
 *   - scale=2, pan=(0,0)  — zoomed in
 *   - scale=2, pan=(10,5) — zoomed in + panned
 *
 * The `clientToWorld` formula from `SceneCanvas.tsx`:
 *   worldX = (clientX - rect.left) / view.scale.x + view.x
 *   worldY = (clientY - rect.top)  / view.scale.y + view.y
 *
 * This matches the `View` spec from `view.ts`:
 *   screenX = (worldX - view.x) * view.scale.x   →   worldX = screenX / scale.x + view.x
 *   where screenX = clientX - rect.left
 */

import { describe, it, expect } from 'vitest';
import { buildAffordanceAt, buildClassifyTarget, type AnchorState } from './affordanceAt';
import { PATH_M, PATH_L, PATH_C, PATH_Z } from 'features/paths/types';
import type { PolygonPath } from 'features/paths/types';

// ---------------------------------------------------------------------------
// Helper: replicate the clientToWorld formula from GestureDispatcherMounter.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// clientToWorld formula
// ---------------------------------------------------------------------------

/** Identity view — hit radii are screen px, so scale 1 makes them world px. */
const UNIT_VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

describe('clientToWorld formula', () => {
  it('identity transform: scale=1, pan=0 — worldX equals screenX', () => {
    const view = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const rect = { left: 0, top: 0 };
    expect(clientToWorld(50, 30, rect, view)).toEqual({ x: 50, y: 30 });
  });

  it('scale=2, pan=0 — client coords are halved in world space', () => {
    const view = { x: 0, y: 0, scale: { x: 2, y: 2 } };
    const rect = { left: 0, top: 0 };
    expect(clientToWorld(100, 80, rect, view)).toEqual({ x: 50, y: 40 });
  });

  it('scale=2, pan=(10,5) — world origin shifted by pan', () => {
    // At pan (10,5), the world point (10,5) maps to screen origin (0,0).
    // So screen (0,0) → world (10,5).
    // screen (100,80) → world (100/2 + 10, 80/2 + 5) = (60, 45).
    const view = { x: 10, y: 5, scale: { x: 2, y: 2 } };
    const rect = { left: 0, top: 0 };
    expect(clientToWorld(100, 80, rect, view)).toEqual({ x: 60, y: 45 });
  });

  it('rect offset: canvas is not at viewport origin', () => {
    // Canvas starts at CSS (20, 30). clientX=70, clientY=80 → screenX=50, screenY=50.
    const view = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const rect = { left: 20, top: 30 };
    expect(clientToWorld(70, 80, rect, view)).toEqual({ x: 50, y: 50 });
  });

  it('round-trip: worldToScreen → clientToWorld recovers original world point', () => {
    const view = { x: 10, y: 5, scale: { x: 2, y: 3 } };
    const rect = { left: 0, top: 0 };
    const worldX = 25, worldY = 15;
    // screen = (worldX - view.x) * scale
    const screenX = (worldX - view.x) * view.scale.x;
    const screenY = (worldY - view.y) * view.scale.y;
    const recovered = clientToWorld(screenX, screenY, rect, view);
    expect(recovered.x).toBeCloseTo(worldX);
    expect(recovered.y).toBeCloseTo(worldY);
  });
});

// ---------------------------------------------------------------------------
// buildClassifyTarget at non-unit scale
// ---------------------------------------------------------------------------

describe('buildClassifyTarget at scale=2 with non-zero pan', () => {
  // Node in world space: {x:10, y:10, w:30, h:30}.
  // At scale=2, pan=(0,0): node appears at screen (20,20)-(80,80).
  // Body center world=(25,25) → client=(50,50).
  // Outside world=(60,60) → client=(120,120).

  const view = { x: 0, y: 0, scale: { x: 2, y: 2 } };
  const rect = { left: 0, top: 0 };

  // One node at world (10,10,30,30), selected.
  const selection = ['node-1'];
  const pickBest = (wx: number, wy: number): string | null => {
    if (wx >= 10 && wx <= 40 && wy >= 10 && wy <= 40) return 'node-1';
    return null;
  };

  const classify = buildClassifyTarget(() => selection, pickBest);

  it('client (50,50) → world (25,25) → "selected-body"', () => {
    const wp = clientToWorld(50, 50, rect, view);
    expect(classify(wp).body).toBe('selected-body');
  });

  it('client (120,120) → world (60,60) → "empty"', () => {
    const wp = clientToWorld(120, 120, rect, view);
    expect(classify(wp).body).toBe('empty');
  });

  it('client (20,20) → world (10,10) → body boundary → "selected-body"', () => {
    const wp = clientToWorld(20, 20, rect, view);
    expect(classify(wp).body).toBe('selected-body');
  });
});

describe('buildClassifyTarget with canvas at non-zero rect offset', () => {
  // Canvas rect starts at CSS (100, 50). Scale=1, pan=0.
  // Node at world (0,0,50,50).
  // Body center world=(25,25) → client=(125, 75).
  // Outside world=(100,100) → client=(200, 150).

  const view = { x: 0, y: 0, scale: { x: 1, y: 1 } };
  const rect = { left: 100, top: 50 };

  const selection = ['node-1'];
  const pickBest = (wx: number, wy: number): string | null => {
    if (wx >= 0 && wx <= 50 && wy >= 0 && wy <= 50) return 'node-1';
    return null;
  };

  const classify = buildClassifyTarget(() => selection, pickBest);

  it('client (125, 75) → world (25,25) → "selected-body"', () => {
    const wp = clientToWorld(125, 75, rect, view);
    expect(classify(wp).body).toBe('selected-body');
  });

  it('client (200, 150) → world (100,100) → "empty"', () => {
    const wp = clientToWorld(200, 150, rect, view);
    expect(classify(wp).body).toBe('empty');
  });
});

// ---------------------------------------------------------------------------
// buildAffordanceAt at scale=2 with non-zero pan
// ---------------------------------------------------------------------------

describe('buildAffordanceAt at scale=2 with non-zero pan (T7 audit)', () => {
  // Node selected: {x:20, y:20, w:40, h:40}. Corner handles at world corners.
  // Top-left handle: world (20, 20).
  // At scale=2, pan=(0,0): client (40, 40).
  // Hit radius = 8 world-units → squared = 64.

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
    // view.x=10 means world origin is at client (10*scale, 5*scale) = (20, 10).
    // clientToWorld(60, 45) with view.x=10, scale=2:
    //   worldX = (60 - 0) / 2 + 10 = 30 + 10 = 40
    //   worldY = (45 - 0) / 2 + 5  = 22.5 + 5 = 27.5
    // Node at (20,20,40,40) → center (40,40). (40,27.5) is inside the node bounds.
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

// ---------------------------------------------------------------------------
// buildAffordanceAt — anchor and control-handle hit-testing
// ---------------------------------------------------------------------------

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

/** Build a two-point bezier path: M(0,0) C(5,-5, 5,15, 10,10) Z
 *  enumerateAnchors → anchor 0 at (0,0), anchor 1 at (10,10).
 *  anchor 0 controlOut at (5,-5); anchor 1 controlIn at (5,15). */
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
    // controlOut of anchor 0 is at (5,-5). Outside edit mode, only anchor
    // points are tested. dist(5,-5 → 0,0) ≈ 7.07 < 8 so anchor:0 should hit
    // rather than controlOut:0.
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
    // anchor 1 is at (10,10). Its controlIn is at (5,15) — dist ≈ 7.07 < 8.
    // hitAnchor prefers controls, so test from exact anchor 1 position:
    // dist(10,10 → anchor1) = 0, dist(10,10 → controlIn(5,15)) = sqrt(25+25) ≈ 7.07.
    // controlIn wins since controls are preferred. Use a point right-of anchor 1
    // where only the anchor is in range, not the control.
    // Anchor 1 at (10,10). controlIn at (5,15): offset (-5,+5) from anchor.
    // Move in direction (+5, -5) from anchor 1: world (15,5).
    // dist(15,5 → anchor1(10,10)) = sqrt(25+25) ≈ 7.07 < 8 → anchor in range.
    // dist(15,5 → controlIn(5,15)) = sqrt(100+100) ≈ 14 > 8 → control NOT in range.
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
