/**
 * affordanceAt + clientToWorld regression: Phase 13 carryforward (Phase 14a T7).
 *
 * Phase 13's report flagged: "correct at scale=1/view.x=0; non-unit-scale needs audit."
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
import { buildAffordanceAt, buildClassifyTarget } from './affordanceAt';

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
    expect(classify(wp)).toBe('selected-body');
  });

  it('client (120,120) → world (60,60) → "empty"', () => {
    const wp = clientToWorld(120, 120, rect, view);
    expect(classify(wp)).toBe('empty');
  });

  it('client (20,20) → world (10,10) → body boundary → "selected-body"', () => {
    const wp = clientToWorld(20, 20, rect, view);
    expect(classify(wp)).toBe('selected-body');
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
    expect(classify(wp)).toBe('selected-body');
  });

  it('client (200, 150) → world (100,100) → "empty"', () => {
    const wp = clientToWorld(200, 150, rect, view);
    expect(classify(wp)).toBe('empty');
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

  const affordanceAt = buildAffordanceAt(() => chromeState as any);

  it('client (40, 40) at scale=2 → world (20,20) → top-left handle hit', () => {
    const wp = clientToWorld(40, 40, rect, view);
    const hit = affordanceAt(wp);
    expect(hit).not.toBeNull();
    expect(hit?.kind).toBe('handle:top-left');
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
    const pannedAffordanceAt = buildAffordanceAt(() => pannedChrome as any);
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
    const pannedAffordanceAt = buildAffordanceAt(() => pannedChrome as any);
    const hit = pannedAffordanceAt(wp);
    expect(hit).not.toBeNull();
    expect(hit?.kind).toBe('handle:top-left');
  });
});
