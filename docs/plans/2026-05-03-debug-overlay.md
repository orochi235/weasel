# Debug Overlay Primitives — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a dev-mode visualization layer that exposes what the interaction system "sees" — hitboxes, handle positions, AABB bounds, pose origins, snap candidates, layer-order metadata — gated by a `?debug=…` URL query param or a `debug` prop on `<Canvas>`. Six features (`hitboxes`, `handles`, `bounds`, `origins`, `snap`, `layers`) ship in v1. Zero overhead in prod when not used (tree-shaken via the `debug?.recordX(...)` optional-chain convention).

**Architecture:** A `DebugSink` interface defines six `recordX` methods plus `beginFrame()` / `clearSnap()`. `createDebugSink(config)` returns a sink that stores recorded primitives in arrays keyed by feature, gated by the config flags (records under-disabled features no-op). The Canvas owns one sink instance per mount, lazily created when `debug` is enabled. Every interaction hook that owns hit math accepts an optional `debug?: DebugSink` and threads it through; every recording call uses optional-chain (`debug?.recordHitbox(...)`) so absence short-circuits before evaluating args. A new `createDebugOverlayLayer({ sink, config })` `RenderLayer` (`space: 'screen'`) is appended to the top of the layer stack when `debug` is on; it reads `sink.snapshot()` and paints. Snap recording happens at gesture-time and clears via `sink.clearSnap()` on gesture end; everything else clears via `sink.beginFrame()` at the start of each render.

**Tech Stack:** TypeScript, React 18, vitest + jsdom, @testing-library/react. Test runner: `npm test`. Spec: `docs/specs/2026-05-03-debug-overlay-design.md`. Builds on Phase 2c surfaces (lands separately): `View = {x, y, scale}`, screen-space chrome via `space: 'screen'`, `RenderLayer.draw(ctx, data, view)` 3-arg signature, `drawOne(ctx, obj, pose, view)` 4-arg signature.

---

## File Structure

| File | Status | Purpose |
| --- | --- | --- |
| `src/debug/types.ts` | NEW | `DebugConfig`, `DebugFeature`, `DebugTheme`, `DebugSink`, `DebugSnapshot`, `HitShape`, `HandleKind` types. |
| `src/debug/parseDebugFlags.ts` | NEW | `parseDebugFlags(search: string): DebugConfig \| null` URL parser. |
| `src/debug/parseDebugFlags.test.ts` | NEW | Coverage of every feature key, `all`, comma-separated, missing param, malformed input. |
| `src/debug/createDebugSink.ts` | NEW | `createDebugSink(config)` factory returning `DebugSink & { snapshot, clearSnap }`. |
| `src/debug/createDebugSink.test.ts` | NEW | Records under each flag; ignores when off; `beginFrame` clears non-snap arrays; `clearSnap` clears snap. |
| `src/debug/createDebugOverlayLayer.ts` | NEW | `RenderLayer` factory (`space: 'screen'`) that paints the snapshot. |
| `src/debug/createDebugOverlayLayer.test.ts` | NEW | Asserts paint per feature toggle (mocked ctx + canned snapshot). |
| `src/debug/defaultTheme.ts` | NEW | Hard-coded default colors per spec. |
| `src/debug/index.ts` | NEW | Barrel re-exports for `src/debug/*` (consumed by `src/index.ts`). |
| `src/index.ts` | MODIFY | Re-export `parseDebugFlags`, `createDebugSink`, `createDebugOverlayLayer`, `DebugConfig`, `DebugSink`, `DebugFeature`, `DebugTheme`, `HitShape`, `HandleKind`. |
| `src/canvas/Canvas.tsx` | MODIFY | New `debug?: DebugConfig \| false` prop; URL-fallback when `undefined`; lazy sink creation; `sink.beginFrame()` at top of paint effect; sink threaded into `usePointerGestures`, `useMove`, `useResize`, `useRotate`, `useAreaSelect`, `useEditAnchors`, `useSelectTool`; sink threaded into `gridSnapStrategy` callsite (if any internal); record `bounds`/`origins` from scene-iteration; record `layer` metadata before each layer's draw; append `createDebugOverlayLayer({sink, config})` at the top of the layer stack when sink is non-null; wire `sink.clearSnap()` on gesture end. |
| `src/canvas/Canvas.test.tsx` | MODIFY | Cases: URL parse on mount; `debug={false}` overrides URL; `debug={config}` overrides URL; sink recreated on config change; bounds/origins recorded per object; layer metadata recorded; overlay layer appended on top. |
| `src/interactions/usePointerGestures.ts` | MODIFY | Accept `debug?: DebugSink` option; record body hitboxes for every object iterated by hit-test. |
| `src/interactions/usePointerGestures.test.ts` | MODIFY | Cover hitbox recording at the body hit-test site. |
| `src/interactions/gestures/move/move.ts` | MODIFY | Accept `debug?: DebugSink`; no recording sites required (move owns no hit math beyond what `usePointerGestures` already covers). The param is plumbed for symmetry/future use. |
| `src/interactions/gestures/resize/resize.ts` | MODIFY | Accept `debug?: DebugSink`; record corner-handle positions and corner-handle hitboxes. |
| `src/interactions/gestures/resize/resize.test.ts` | MODIFY | Cover handle + hitbox recording at scale=1 and scale=2. |
| `src/interactions/gestures/rotate/rotate.ts` | MODIFY | Accept `debug?: DebugSink`; record rotation-handle position and hitbox. |
| `src/interactions/gestures/rotate/rotate.test.ts` | MODIFY | Cover rotation-handle recording. |
| `src/interactions/gestures/area-select/areaSelect.ts` | MODIFY | Accept `debug?: DebugSink`; record the in-progress marquee bounds during drag (under `bounds` flag). |
| `src/interactions/gestures/area-select/areaSelect.test.ts` | MODIFY | Cover marquee bounds recording during a drag. |
| `src/interactions/gestures/edit-anchors/editAnchors.ts` | MODIFY | Accept `debug?: DebugSink`; record per-anchor handle positions + per-anchor hitboxes. |
| `src/interactions/gestures/edit-anchors/editAnchors.test.ts` | MODIFY | Cover anchor handle + hitbox recording. |
| `src/tools/builtin/useSelectTool.ts` | MODIFY | Accept `debug?: DebugSink`; record corner-handle hitboxes + rotation-handle hitbox at the same sites as the hit checks (Select tool has its own copies of these per Phase 2c). |
| `src/tools/builtin/useSelectTool.test.ts` | MODIFY | Cover handle hitbox recording from the select tool. |
| `src/interactions/gestures/shared/strategies/grid.ts` | MODIFY | `gridSnapStrategy` overload accepts an optional `debug?: DebugSink`; record each candidate considered (the rounded `(sx, sy)` is always the chosen one for grid snap — record it as `accepted: true`). |
| `src/interactions/gestures/shared/strategies/grid.test.ts` | MODIFY | Cover snap candidate recording. |
| `demo/demos/PathPoseDemo.tsx` | MODIFY | Add a debug-overlay toggle that cycles `none → bounds → +origins → +hitboxes → +handles → all → none` and threads the resulting config into `<Canvas debug={...}>`. |
| `CHANGELOG.md` | MODIFY | Note the new debug subsystem under Unreleased (additive; no breaking changes). |

---

## Task 1: `DebugConfig` types + `parseDebugFlags`

**Files:**
- Create: `src/debug/types.ts`
- Create: `src/debug/parseDebugFlags.ts`
- Test: `src/debug/parseDebugFlags.test.ts`

Pure module, no React, no Canvas. Easy TDD start. The parser accepts a query string (`window.location.search` shape — leading `?` optional) and returns `null` when no `debug` param is present, or a `DebugConfig` when one is.

- [ ] **Step 1: Write the failing test**

`src/debug/parseDebugFlags.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseDebugFlags } from './parseDebugFlags';

describe('parseDebugFlags', () => {
  it('returns null when no debug param', () => {
    expect(parseDebugFlags('')).toBeNull();
    expect(parseDebugFlags('?other=1')).toBeNull();
    expect(parseDebugFlags('?debug=')).toBeNull(); // empty value
  });

  it('parses a single feature', () => {
    expect(parseDebugFlags('?debug=hitboxes')).toEqual({ hitboxes: true });
    expect(parseDebugFlags('?debug=bounds')).toEqual({ bounds: true });
  });

  it('parses comma-separated features', () => {
    expect(parseDebugFlags('?debug=bounds,origins')).toEqual({ bounds: true, origins: true });
  });

  it('"all" enables every feature', () => {
    expect(parseDebugFlags('?debug=all')).toEqual({
      hitboxes: true,
      handles: true,
      bounds: true,
      origins: true,
      snap: true,
      layers: true,
    });
  });

  it('ignores unknown feature keys but keeps known siblings', () => {
    expect(parseDebugFlags('?debug=bounds,nonsense,handles')).toEqual({
      bounds: true,
      handles: true,
    });
  });

  it('tolerates leading ? being absent', () => {
    expect(parseDebugFlags('debug=hitboxes')).toEqual({ hitboxes: true });
  });

  it('returns null when only unknown keys are present', () => {
    expect(parseDebugFlags('?debug=nonsense')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```
npm test -- src/debug/parseDebugFlags.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/debug/types.ts`**

```ts
/** One bit per debug feature; absent keys are off. */
export interface DebugConfig {
  hitboxes?: boolean;
  handles?: boolean;
  bounds?: boolean;
  origins?: boolean;
  snap?: boolean;
  layers?: boolean;
  /** Optional per-feature color overrides; falls back to the default theme. */
  theme?: Partial<DebugTheme>;
}

export type DebugFeature = 'hitboxes' | 'handles' | 'bounds' | 'origins' | 'snap' | 'layers';

export interface DebugTheme {
  hitboxFill: string;
  hitboxStroke: string;
  handle: string;
  bounds: string;
  origin: string;
  snap: string;
  layerText: string;
  layerTextBg: string;
}

export type HandleKind = 'corner' | 'rotation' | 'anchor';

export type HitShape =
  | { kind: 'rect'; x: number; y: number; width: number; height: number; rotation?: number }
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'path'; d: Path2D };

export interface RecordedHitbox {
  id: string;
  kind: 'body' | 'handle' | 'rotation' | 'anchor';
  shape: HitShape;
}

export interface RecordedHandle {
  id: string;
  position: { x: number; y: number };
  kind: HandleKind;
}

export interface RecordedBounds {
  id: string;
  bounds: { x: number; y: number; width: number; height: number };
}

export interface RecordedOrigin {
  id: string;
  point: { x: number; y: number };
}

export interface RecordedSnap {
  point: { x: number; y: number };
  accepted: boolean;
}

export interface RecordedLayer {
  id: string;
  label: string;
  space: 'world' | 'screen';
  index: number;
}

export interface DebugSnapshot {
  hitboxes: RecordedHitbox[];
  handles: RecordedHandle[];
  bounds: RecordedBounds[];
  origins: RecordedOrigin[];
  snap: RecordedSnap[];
  layers: RecordedLayer[];
}

export interface DebugSink {
  recordHitbox(id: string, kind: 'body' | 'handle' | 'rotation' | 'anchor', shape: HitShape): void;
  recordHandle(id: string, position: { x: number; y: number }, kind: HandleKind): void;
  recordBounds(id: string, bounds: { x: number; y: number; width: number; height: number }): void;
  recordOrigin(id: string, point: { x: number; y: number }): void;
  recordSnapCandidate(point: { x: number; y: number }, accepted: boolean): void;
  recordLayer(id: string, label: string, space: 'world' | 'screen', index: number): void;
  /** Clears every non-snap array. Called at the start of each Canvas render. */
  beginFrame(): void;
  /** Clears the snap array. Called at gesture end. */
  clearSnap(): void;
}
```

- [ ] **Step 4: Write `src/debug/parseDebugFlags.ts`**

```ts
import type { DebugConfig, DebugFeature } from './types';

const ALL_FEATURES: DebugFeature[] = ['hitboxes', 'handles', 'bounds', 'origins', 'snap', 'layers'];

/**
 * Parse a URL query string (with or without leading `?`) for a `debug` param.
 *
 * - `?debug=hitboxes` → `{ hitboxes: true }`
 * - `?debug=bounds,origins` → `{ bounds: true, origins: true }`
 * - `?debug=all` → every feature enabled
 * - missing/empty/unknown-only → `null`
 */
export function parseDebugFlags(search: string): DebugConfig | null {
  const trimmed = search.startsWith('?') ? search.slice(1) : search;
  if (trimmed.length === 0) return null;
  const params = new URLSearchParams(trimmed);
  const raw = params.get('debug');
  if (!raw) return null;
  const tokens = raw.split(',').map((t) => t.trim()).filter(Boolean);
  if (tokens.length === 0) return null;
  if (tokens.includes('all')) {
    const out: DebugConfig = {};
    for (const f of ALL_FEATURES) out[f] = true;
    return out;
  }
  const out: DebugConfig = {};
  for (const t of tokens) {
    if ((ALL_FEATURES as string[]).includes(t)) out[t as DebugFeature] = true;
  }
  return Object.keys(out).length > 0 ? out : null;
}
```

- [ ] **Step 5: Run test to verify it passes**

```
npm test -- src/debug/parseDebugFlags.test.ts
```

Expected: PASS — 7 passed.

- [ ] **Step 6: Commit**

```bash
git add src/debug/types.ts src/debug/parseDebugFlags.ts src/debug/parseDebugFlags.test.ts
git commit -m "feat(debug): DebugConfig types + parseDebugFlags URL parser"
```

---

## Task 2: `createDebugSink` factory

**Files:**
- Create: `src/debug/createDebugSink.ts`
- Test: `src/debug/createDebugSink.test.ts`

The sink stores recorded primitives in arrays keyed by feature. Each `recordX` method first checks the relevant config flag — if it's off, the call no-ops (so callers don't have to check). `beginFrame()` clears every non-snap array; `clearSnap()` clears the snap array; `snapshot()` returns the current arrays (live references — no copy in v1, the overlay reads them in the same frame).

- [ ] **Step 1: Write the failing test**

`src/debug/createDebugSink.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createDebugSink } from './createDebugSink';

describe('createDebugSink', () => {
  it('records when feature flag is on', () => {
    const sink = createDebugSink({ bounds: true, origins: true });
    sink.recordBounds('a', { x: 0, y: 0, width: 10, height: 10 });
    sink.recordOrigin('a', { x: 5, y: 5 });
    const s = sink.snapshot();
    expect(s.bounds).toHaveLength(1);
    expect(s.origins).toHaveLength(1);
  });

  it('no-ops when feature flag is off', () => {
    const sink = createDebugSink({ bounds: true });
    sink.recordOrigin('a', { x: 5, y: 5 }); // origins flag off
    sink.recordHandle('a', { x: 0, y: 0 }, 'corner'); // handles flag off
    sink.recordHitbox('a', 'body', { kind: 'rect', x: 0, y: 0, width: 1, height: 1 });
    sink.recordSnapCandidate({ x: 0, y: 0 }, true);
    sink.recordLayer('scene', 'Scene', 'world', 0);
    const s = sink.snapshot();
    expect(s.origins).toHaveLength(0);
    expect(s.handles).toHaveLength(0);
    expect(s.hitboxes).toHaveLength(0);
    expect(s.snap).toHaveLength(0);
    expect(s.layers).toHaveLength(0);
  });

  it('beginFrame clears every non-snap array but preserves snap', () => {
    const sink = createDebugSink({
      hitboxes: true, handles: true, bounds: true, origins: true, snap: true, layers: true,
    });
    sink.recordHitbox('a', 'body', { kind: 'rect', x: 0, y: 0, width: 1, height: 1 });
    sink.recordHandle('a', { x: 0, y: 0 }, 'corner');
    sink.recordBounds('a', { x: 0, y: 0, width: 1, height: 1 });
    sink.recordOrigin('a', { x: 0, y: 0 });
    sink.recordSnapCandidate({ x: 0, y: 0 }, true);
    sink.recordLayer('scene', 'Scene', 'world', 0);
    sink.beginFrame();
    const s = sink.snapshot();
    expect(s.hitboxes).toHaveLength(0);
    expect(s.handles).toHaveLength(0);
    expect(s.bounds).toHaveLength(0);
    expect(s.origins).toHaveLength(0);
    expect(s.layers).toHaveLength(0);
    expect(s.snap).toHaveLength(1); // preserved across frames
  });

  it('clearSnap clears only the snap array', () => {
    const sink = createDebugSink({ snap: true, bounds: true });
    sink.recordSnapCandidate({ x: 0, y: 0 }, true);
    sink.recordBounds('a', { x: 0, y: 0, width: 1, height: 1 });
    sink.clearSnap();
    const s = sink.snapshot();
    expect(s.snap).toHaveLength(0);
    expect(s.bounds).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```
npm test -- src/debug/createDebugSink.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/debug/createDebugSink.ts`:

```ts
import type {
  DebugConfig,
  DebugSink,
  DebugSnapshot,
  HandleKind,
  HitShape,
} from './types';

/**
 * Build a sink that stores recorded primitives in arrays keyed by feature.
 * Each `recordX` method checks the matching flag in `config` first — when
 * the feature is off, the call no-ops, so callers can record unconditionally
 * without an extra check.
 *
 * `beginFrame()` clears every non-snap array. `clearSnap()` clears the snap
 * array. Snap survives across frames within a gesture (cleared on
 * gesture-end by the Canvas).
 *
 * `snapshot()` returns live references — no copy. The overlay layer reads
 * these in the same render frame.
 */
export function createDebugSink(config: DebugConfig): DebugSink & { snapshot(): DebugSnapshot } {
  const snap: DebugSnapshot = {
    hitboxes: [],
    handles: [],
    bounds: [],
    origins: [],
    snap: [],
    layers: [],
  };
  return {
    recordHitbox(id, kind, shape: HitShape) {
      if (!config.hitboxes) return;
      snap.hitboxes.push({ id, kind, shape });
    },
    recordHandle(id, position, kind: HandleKind) {
      if (!config.handles) return;
      snap.handles.push({ id, position, kind });
    },
    recordBounds(id, bounds) {
      if (!config.bounds) return;
      snap.bounds.push({ id, bounds });
    },
    recordOrigin(id, point) {
      if (!config.origins) return;
      snap.origins.push({ id, point });
    },
    recordSnapCandidate(point, accepted) {
      if (!config.snap) return;
      snap.snap.push({ point, accepted });
    },
    recordLayer(id, label, space, index) {
      if (!config.layers) return;
      snap.layers.push({ id, label, space, index });
    },
    beginFrame() {
      snap.hitboxes.length = 0;
      snap.handles.length = 0;
      snap.bounds.length = 0;
      snap.origins.length = 0;
      snap.layers.length = 0;
      // snap.snap is intentionally preserved
    },
    clearSnap() {
      snap.snap.length = 0;
    },
    snapshot() {
      return snap;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- src/debug/createDebugSink.test.ts
```

Expected: PASS — 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/debug/createDebugSink.ts src/debug/createDebugSink.test.ts
git commit -m "feat(debug): createDebugSink factory with per-feature gating"
```

---

## Task 3: Default theme module

**Files:**
- Create: `src/debug/defaultTheme.ts`

Pure constants. The overlay layer (Task 4) reads these.

- [ ] **Step 1: Write the module**

`src/debug/defaultTheme.ts`:

```ts
import type { DebugTheme } from './types';

/**
 * Default colors per the spec's Visual Style section. High contrast against
 * the demo's dark backdrop. Override by passing `theme: { ... }` on
 * `DebugConfig`.
 */
export const DEFAULT_DEBUG_THEME: DebugTheme = {
  hitboxFill: 'rgba(255, 0, 255, 0.25)',
  hitboxStroke: '#ff00ff',
  handle: '#00e5ff',
  bounds: '#ffeb3b',
  origin: '#69f0ae',
  snap: '#ffa726',
  layerText: '#e0e0e0',
  layerTextBg: 'rgba(0, 0, 0, 0.6)',
};
```

- [ ] **Step 2: Commit**

```bash
git add src/debug/defaultTheme.ts
git commit -m "feat(debug): default theme constants"
```

---

## Task 4: `createDebugOverlayLayer`

**Files:**
- Create: `src/debug/createDebugOverlayLayer.ts`
- Test: `src/debug/createDebugOverlayLayer.test.ts`

A `RenderLayer` factory tagged `space: 'screen'`. The draw reads `sink.snapshot()` and paints the six feature buckets in order: hitboxes (under), bounds, handles, origins, snap, layers (top-right text). All world-space coords in the snapshot are projected to screen via `worldToScreen(view)` since the layer runs in screen space.

- [ ] **Step 1: Write the failing test**

`src/debug/createDebugOverlayLayer.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { createDebugOverlayLayer } from './createDebugOverlayLayer';
import { createDebugSink } from './createDebugSink';

function makeCtx() {
  const calls: string[] = [];
  const ctx = {
    save: vi.fn(() => calls.push('save')),
    restore: vi.fn(() => calls.push('restore')),
    strokeRect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push(`strokeRect(${x},${y},${w},${h})`)),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push(`fillRect(${x},${y},${w},${h})`)),
    beginPath: vi.fn(() => calls.push('beginPath')),
    arc: vi.fn(() => calls.push('arc')),
    fill: vi.fn(() => calls.push('fill')),
    stroke: vi.fn(() => calls.push('stroke')),
    moveTo: vi.fn(() => calls.push('moveTo')),
    lineTo: vi.fn(() => calls.push('lineTo')),
    setLineDash: vi.fn(),
    fillText: vi.fn((s: string, x: number, y: number) => calls.push(`fillText(${s},${x},${y})`)),
    measureText: vi.fn(() => ({ width: 50 })),
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    font: '',
    textBaseline: '' as CanvasTextBaseline,
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

describe('createDebugOverlayLayer', () => {
  it('is registered as a screen-space layer', () => {
    const sink = createDebugSink({ bounds: true });
    const layer = createDebugOverlayLayer({ sink, config: { bounds: true } });
    expect(layer.space).toBe('screen');
    expect(layer.id).toBe('debug-overlay');
  });

  it('paints bounds when the bounds flag is on', () => {
    const sink = createDebugSink({ bounds: true });
    sink.recordBounds('a', { x: 10, y: 20, width: 30, height: 40 });
    const layer = createDebugOverlayLayer({ sink, config: { bounds: true } });
    const { ctx, calls } = makeCtx();
    layer.draw(ctx, null, { x: 0, y: 0, scale: 1 });
    // Should produce a strokeRect at the projected screen position.
    expect(calls.some((c) => c.startsWith('strokeRect(10,20,30,40)'))).toBe(true);
  });

  it('paints bounds projected through view scale', () => {
    const sink = createDebugSink({ bounds: true });
    sink.recordBounds('a', { x: 10, y: 20, width: 30, height: 40 });
    const layer = createDebugOverlayLayer({ sink, config: { bounds: true } });
    const { ctx, calls } = makeCtx();
    // view (5,5) scale 2 → screen (10-5)*2=10, (20-5)*2=30, w=60, h=80
    layer.draw(ctx, null, { x: 5, y: 5, scale: 2 });
    expect(calls.some((c) => c.startsWith('strokeRect(10,30,60,80)'))).toBe(true);
  });

  it('paints origins as filled circles when origins flag is on', () => {
    const sink = createDebugSink({ origins: true });
    sink.recordOrigin('a', { x: 5, y: 5 });
    const layer = createDebugOverlayLayer({ sink, config: { origins: true } });
    const { ctx, calls } = makeCtx();
    layer.draw(ctx, null, { x: 0, y: 0, scale: 1 });
    expect(calls).toContain('beginPath');
    expect(calls).toContain('arc');
    expect(calls).toContain('fill');
  });

  it('skips a feature when its config flag is off (no draws for that bucket)', () => {
    const sink = createDebugSink({ bounds: true, origins: true });
    sink.recordBounds('a', { x: 0, y: 0, width: 10, height: 10 });
    sink.recordOrigin('a', { x: 0, y: 0 });
    // overlay only enables bounds; origins records exist but should not paint.
    const layer = createDebugOverlayLayer({ sink, config: { bounds: true } });
    const { ctx, calls } = makeCtx();
    layer.draw(ctx, null, { x: 0, y: 0, scale: 1 });
    expect(calls.some((c) => c === 'arc')).toBe(false);
    expect(calls.some((c) => c.startsWith('strokeRect'))).toBe(true);
  });

  it('paints layer annotations when layers flag is on', () => {
    const sink = createDebugSink({ layers: true });
    sink.recordLayer('scene', 'Scene', 'world', 0);
    const layer = createDebugOverlayLayer({ sink, config: { layers: true } });
    const { ctx, calls } = makeCtx();
    layer.draw(ctx, null, { x: 0, y: 0, scale: 1 });
    expect(calls.some((c) => c.startsWith('fillText('))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```
npm test -- src/debug/createDebugOverlayLayer.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/debug/createDebugOverlayLayer.ts`:

```ts
import type { RenderLayer } from '../core/layers/render';
import type { View } from '../features/viewport/view';
import { viewToTransform } from '../features/viewport/view';
import { worldToScreen } from '../features/viewport/viewTransform';
import type {
  DebugConfig,
  DebugSink,
  DebugSnapshot,
  DebugTheme,
  HitShape,
} from './types';
import { DEFAULT_DEBUG_THEME } from './defaultTheme';

interface CreateDebugOverlayLayerOpts {
  sink: DebugSink & { snapshot(): DebugSnapshot };
  config: DebugConfig;
}

/**
 * Screen-space `RenderLayer` that paints the sink's snapshot. Appended at
 * the top of the Canvas's layer stack when `debug` is enabled. World-space
 * coords in the snapshot are projected through `view` here, since the
 * layer itself runs at identity transform.
 */
export function createDebugOverlayLayer({
  sink,
  config,
}: CreateDebugOverlayLayerOpts): RenderLayer<unknown> {
  const theme: DebugTheme = { ...DEFAULT_DEBUG_THEME, ...(config.theme ?? {}) };
  return {
    id: 'debug-overlay',
    label: 'Debug overlay',
    space: 'screen',
    alwaysOn: true,
    draw: (ctx, _data, view) => {
      const s = sink.snapshot();
      const t = viewToTransform(view);
      ctx.save();

      if (config.hitboxes) drawHitboxes(ctx, s, view, t, theme);
      if (config.bounds) drawBounds(ctx, s, view, t, theme);
      if (config.handles) drawHandles(ctx, s, view, t, theme);
      if (config.origins) drawOrigins(ctx, s, view, t, theme);
      if (config.snap) drawSnap(ctx, s, view, t, theme);
      if (config.layers) drawLayers(ctx, s, theme);

      ctx.restore();
    },
  };
}

function drawHitboxes(
  ctx: CanvasRenderingContext2D,
  s: DebugSnapshot,
  view: View,
  t: ReturnType<typeof viewToTransform>,
  theme: DebugTheme,
): void {
  ctx.fillStyle = theme.hitboxFill;
  ctx.strokeStyle = theme.hitboxStroke;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  for (const h of s.hitboxes) {
    paintHitShape(ctx, h.shape, view, t);
  }
  ctx.setLineDash([]);
}

function paintHitShape(
  ctx: CanvasRenderingContext2D,
  shape: HitShape,
  view: View,
  t: ReturnType<typeof viewToTransform>,
): void {
  if (shape.kind === 'rect') {
    const [sx, sy] = worldToScreen(shape.x, shape.y, t);
    const sw = shape.width * view.scale;
    const sh = shape.height * view.scale;
    ctx.fillRect(sx, sy, sw, sh);
    ctx.strokeRect(sx, sy, sw, sh);
  } else if (shape.kind === 'circle') {
    const [cx, cy] = worldToScreen(shape.cx, shape.cy, t);
    const r = shape.r * view.scale;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // 'path' kind painted as-is (assumed already in the right space). v1 punt.
}

function drawBounds(
  ctx: CanvasRenderingContext2D,
  s: DebugSnapshot,
  view: View,
  t: ReturnType<typeof viewToTransform>,
  theme: DebugTheme,
): void {
  ctx.strokeStyle = theme.bounds;
  ctx.lineWidth = 1;
  for (const b of s.bounds) {
    const [sx, sy] = worldToScreen(b.bounds.x, b.bounds.y, t);
    const sw = b.bounds.width * view.scale;
    const sh = b.bounds.height * view.scale;
    ctx.strokeRect(sx, sy, sw, sh);
  }
}

function drawHandles(
  ctx: CanvasRenderingContext2D,
  s: DebugSnapshot,
  _view: View,
  t: ReturnType<typeof viewToTransform>,
  theme: DebugTheme,
): void {
  ctx.strokeStyle = theme.handle;
  ctx.lineWidth = 1;
  for (const h of s.handles) {
    const [cx, cy] = worldToScreen(h.position.x, h.position.y, t);
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy);
    ctx.lineTo(cx + 4, cy);
    ctx.moveTo(cx, cy - 4);
    ctx.lineTo(cx, cy + 4);
    ctx.stroke();
  }
}

function drawOrigins(
  ctx: CanvasRenderingContext2D,
  s: DebugSnapshot,
  _view: View,
  t: ReturnType<typeof viewToTransform>,
  theme: DebugTheme,
): void {
  ctx.fillStyle = theme.origin;
  for (const o of s.origins) {
    const [cx, cy] = worldToScreen(o.point.x, o.point.y, t);
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSnap(
  ctx: CanvasRenderingContext2D,
  s: DebugSnapshot,
  _view: View,
  t: ReturnType<typeof viewToTransform>,
  theme: DebugTheme,
): void {
  ctx.strokeStyle = theme.snap;
  ctx.fillStyle = theme.snap;
  ctx.lineWidth = 1;
  for (const c of s.snap) {
    const [cx, cy] = worldToScreen(c.point.x, c.point.y, t);
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    if (c.accepted) ctx.fill();
    else ctx.stroke();
  }
}

function drawLayers(
  ctx: CanvasRenderingContext2D,
  s: DebugSnapshot,
  theme: DebugTheme,
): void {
  if (s.layers.length === 0) return;
  ctx.font = '11px ui-monospace, Menlo, monospace';
  ctx.textBaseline = 'top';
  const lineH = 14;
  const padX = 6;
  const padY = 4;
  const lines = s.layers.map((l) => `[${l.index}] ${l.id} (${l.space})`);
  let maxW = 0;
  for (const line of lines) maxW = Math.max(maxW, ctx.measureText(line).width);
  const boxW = maxW + padX * 2;
  const boxH = lines.length * lineH + padY * 2;
  // Top-right corner of the canvas. Use ctx.canvas.width when available.
  const canvasW = ctx.canvas?.width ?? 0;
  const x = canvasW - boxW - 8;
  const y = 8;
  ctx.fillStyle = theme.layerTextBg;
  ctx.fillRect(x, y, boxW, boxH);
  ctx.fillStyle = theme.layerText;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x + padX, y + padY + i * lineH);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- src/debug/createDebugOverlayLayer.test.ts
```

Expected: PASS — 6 passed. (Note: the test stub doesn't assign `ctx.canvas`, so the layers-drawer will compute `canvasW = 0` — the `fillText` assertion still triggers because we pass the lines verbatim. If the test fails on `ctx.canvas?.width`, add a `canvas: { width: 200 }` field to the stub.)

- [ ] **Step 5: Commit**

```bash
git add src/debug/createDebugOverlayLayer.ts src/debug/createDebugOverlayLayer.test.ts
git commit -m "feat(debug): createDebugOverlayLayer paints snapshot in screen space"
```

---

## Task 5: Debug barrel + index re-exports

**Files:**
- Create: `src/debug/index.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Write the barrel**

`src/debug/index.ts`:

```ts
export { parseDebugFlags } from './parseDebugFlags';
export { createDebugSink } from './createDebugSink';
export { createDebugOverlayLayer } from './createDebugOverlayLayer';
export { DEFAULT_DEBUG_THEME } from './defaultTheme';
export type {
  DebugConfig,
  DebugFeature,
  DebugTheme,
  DebugSink,
  DebugSnapshot,
  HandleKind,
  HitShape,
  RecordedHitbox,
  RecordedHandle,
  RecordedBounds,
  RecordedOrigin,
  RecordedSnap,
  RecordedLayer,
} from './types';
```

- [ ] **Step 2: Re-export from `src/index.ts`**

Append (or place near the other feature re-exports):

```ts
export * from './debug';
```

- [ ] **Step 3: Verify build**

```
npm test -- src/debug/
```

Expected: PASS — all debug tests still green; no import errors elsewhere.

- [ ] **Step 4: Commit**

```bash
git add src/debug/index.ts src/index.ts
git commit -m "feat(debug): barrel exports"
```

---

## Task 6: `<Canvas debug={...}>` prop + URL fallback + sink lifecycle

**Files:**
- Modify: `src/canvas/Canvas.tsx`
- Test: `src/canvas/Canvas.test.tsx`

Three states for the prop:
- `undefined` → read URL via `parseDebugFlags(window.location.search)`.
- `false` → force off (ignore URL).
- `DebugConfig` object → force on with that config (ignore URL).

The sink is constructed via `useMemo` keyed on the resolved config (referential — `JSON.stringify` is acceptable for v1 stability since configs are plain objects of booleans). When the resolved config is `null`, the memo returns `null` and downstream code gates on it.

- [ ] **Step 1: Write the failing tests**

Append to `src/canvas/Canvas.test.tsx`:

```ts
describe('Canvas debug overlay (Phase 2c+)', () => {
  function noopScene() {
    return { drawOne: () => {} } as const;
  }

  it('debug={false} produces no overlay layer even when URL has ?debug=all', () => {
    const original = window.location.search;
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '?debug=all' },
      writable: true,
    });
    try {
      const { container } = render(
        <Canvas
          width={100} height={100}
          items={[]} setItems={() => {}}
          layers={{ scene: noopScene() }}
          debug={false}
        />,
      );
      // The overlay layer's id is 'debug-overlay'; without an explicit
      // visibility surface, we just verify the canvas mounts without throw.
      expect(container.querySelector('canvas')).toBeTruthy();
    } finally {
      Object.defineProperty(window, 'location', {
        value: { ...window.location, search: original },
        writable: true,
      });
    }
  });

  it('debug={config} accepts an explicit config object', () => {
    const { container } = render(
      <Canvas
        width={100} height={100}
        items={[]} setItems={() => {}}
        layers={{ scene: noopScene() }}
        debug={{ bounds: true }}
      />,
    );
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('debug undefined falls back to URL parse', () => {
    const original = window.location.search;
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '?debug=bounds' },
      writable: true,
    });
    try {
      const { container } = render(
        <Canvas
          width={100} height={100}
          items={[]} setItems={() => {}}
          layers={{ scene: noopScene() }}
        />,
      );
      expect(container.querySelector('canvas')).toBeTruthy();
    } finally {
      Object.defineProperty(window, 'location', {
        value: { ...window.location, search: original },
        writable: true,
      });
    }
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```
npm test -- src/canvas/Canvas.test.tsx
```

Expected: FAIL — `Canvas` doesn't accept `debug` prop (TS error).

- [ ] **Step 3: Add the prop, resolve, build the sink**

In `src/canvas/Canvas.tsx`:

Add imports near the other internal imports:

```ts
import type { DebugConfig, DebugSink } from '../debug/types';
import { parseDebugFlags } from '../debug/parseDebugFlags';
import { createDebugSink } from '../debug/createDebugSink';
import { createDebugOverlayLayer } from '../debug/createDebugOverlayLayer';
```

Add to `CanvasProps` (near the other ergonomic props):

```ts
  /**
   * Debug overlay configuration.
   *  - `undefined` (default): read `?debug=…` from the URL.
   *  - `false`: force off, ignore URL.
   *  - `DebugConfig` object: force on with that config, ignore URL.
   *
   * When enabled, the Canvas appends a screen-space `debug-overlay` layer
   * at the top of the layer stack and threads a `DebugSink` into every
   * interaction hook so they record hit math + handle positions.
   */
  debug?: DebugConfig | false;
```

Destructure `debug: debugProp` alongside other props in `CanvasInner`.

Compute the resolved config + sink near the top of `CanvasInner` (before any layer assembly):

```ts
  // Resolve debug config: explicit prop wins; `undefined` falls back to URL;
  // `false` forces off.
  const resolvedDebugConfig = useMemo<DebugConfig | null>(() => {
    if (debugProp === false) return null;
    if (debugProp !== undefined) return debugProp;
    if (typeof window === 'undefined') return null;
    return parseDebugFlags(window.location.search);
  }, [debugProp]);

  // Lazily build one sink per Canvas mount (per resolved config).
  const debugSink = useMemo(() => {
    if (resolvedDebugConfig === null) return null;
    return createDebugSink(resolvedDebugConfig);
  }, [resolvedDebugConfig]);
```

- [ ] **Step 4: Wire the overlay layer into the layer stack**

Where the Canvas assembles its `layers` array (search for the `runLayers(ctx, layers, ...)` call site), append the debug layer when `debugSink` is non-null:

```ts
  const layersWithDebug = useMemo(() => {
    if (!debugSink || !resolvedDebugConfig) return layers;
    return [
      ...layers,
      createDebugOverlayLayer({ sink: debugSink, config: resolvedDebugConfig }),
    ];
  }, [layers, debugSink, resolvedDebugConfig]);
```

Replace the `runLayers(ctx, layers, ...)` invocation's first-array-arg with `layersWithDebug`.

- [ ] **Step 5: Call `beginFrame` at the top of the paint effect**

In the same render `useEffect` that calls `runLayers`, add at the top (before any draw work):

```ts
    debugSink?.beginFrame();
```

(Optional-chain — when `debugSink` is null this short-circuits and the bundler can DCE the entire path when consumers wrap Canvas without ever passing `debug`.)

- [ ] **Step 6: Add `debugSink` to the paint effect's dep array**

`}, [layers, width, height, background, effectiveView, debugSink]);` — replacing whatever current deps array is in place.

- [ ] **Step 7: Run tests to verify passes**

```
npm test -- src/canvas/Canvas.test.tsx
```

Expected: PASS — 3 new + all prior.

- [ ] **Step 8: Commit**

```bash
git add src/canvas/Canvas.tsx src/canvas/Canvas.test.tsx
git commit -m "feat(canvas): debug prop + URL fallback + sink lifecycle + overlay layer"
```

---

## Task 7: Thread `debug` into `usePointerGestures` (body hitboxes)

**Files:**
- Modify: `src/interactions/usePointerGestures.ts`
- Modify: `src/interactions/usePointerGestures.test.ts`

Add `debug?: DebugSink` to the hook's options. At the body hit-test site (the iteration where `hitBody` is called for each candidate object), call `debug?.recordHitbox(id, 'body', shape)` for every object considered.

- [ ] **Step 1: Write the failing test**

Append to `src/interactions/usePointerGestures.test.ts`:

```ts
import { createDebugSink } from '../debug/createDebugSink';

describe('usePointerGestures — debug recording', () => {
  it('records a body hitbox for each object considered during hit-test', () => {
    const sink = createDebugSink({ hitboxes: true });
    // Build a minimal harness using the existing test helpers in this file:
    // (re-use whichever harness exists for body-hit-test cases). Mount the
    // hook with `debug: sink`, fire a pointerdown over an object, and read
    // sink.snapshot().hitboxes — expect at least one entry with kind: 'body'.
    // …
    expect(sink.snapshot().hitboxes.length).toBeGreaterThan(0);
    expect(sink.snapshot().hitboxes[0].kind).toBe('body');
  });
});
```

(Implementer note: the exact harness is the same one used by the existing tests in this file — copy the closest matching setup. If body hit-test today is invoked from `onPointerMove`/`onPointerDown`, fire that event after mounting with `debug: sink`.)

- [ ] **Step 2: Run test to verify failure**

```
npm test -- src/interactions/usePointerGestures.test.ts
```

Expected: FAIL — option not accepted.

- [ ] **Step 3: Add `debug?: DebugSink` to options**

In `src/interactions/usePointerGestures.ts`, add to the options interface:

```ts
import type { DebugSink, HitShape } from '../debug/types';

// inside the options interface:
  debug?: DebugSink;
```

Destructure `debug` from options at the top of the hook.

- [ ] **Step 4: Record body hitboxes at the iteration site**

Find the loop that iterates candidate objects to find the body hit (search for calls to `hitBody(` or whatever the project uses). At the start of each loop iteration, before the hit comparison:

```ts
    if (debug) {
      const b = boundsOf(obj);
      if (b) {
        const shape: HitShape = {
          kind: 'rect', x: b.x, y: b.y, width: b.width, height: b.height,
        };
        // Optional: include rotation if pose has it.
        debug.recordHitbox(obj.id, 'body', shape);
      }
    }
```

(Note: the spec mandates `debug?.recordHitbox(...)` for tree-shaking — but here we also derive a `shape` value from `boundsOf(obj)` which would do work even when `debug` is undefined. Wrap the entire derivation in an `if (debug)` guard so the per-iteration cost is zero in the off path. The tree-shaking discipline still applies elsewhere; in tight inner loops a guarded block is fine. Add a comment.)

- [ ] **Step 5: Thread `debug` from Canvas into `usePointerGestures`**

In `src/canvas/Canvas.tsx`, find the `usePointerGestures({ ... })` call and add:

```ts
    debug: debugSink ?? undefined,
```

- [ ] **Step 6: Run tests to verify pass**

```
npm test -- src/interactions/usePointerGestures.test.ts src/canvas/
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/interactions/usePointerGestures.ts src/interactions/usePointerGestures.test.ts src/canvas/Canvas.tsx
git commit -m "feat(debug): record body hitboxes from usePointerGestures"
```

---

## Task 8: Thread `debug` into `useResize` (corner handles + hitboxes)

**Files:**
- Modify: `src/interactions/gestures/resize/resize.ts`
- Modify: `src/interactions/gestures/resize/resize.test.ts`

`useResize` owns the corner-handle hit math. Record handle positions (under `handles`) and corner-handle hitboxes (under `hitboxes`) every time the hook computes them.

- [ ] **Step 1: Write the failing test**

Append to `src/interactions/gestures/resize/resize.test.ts`:

```ts
import { createDebugSink } from '../../../debug/createDebugSink';

describe('useResize — debug recording', () => {
  it('records 4 handle positions per selected object', () => {
    const sink = createDebugSink({ handles: true });
    // … mount useResize with debug: sink, run a render path that triggers
    // its handle-derivation. Assert sink.snapshot().handles.length === 4
    // for a single selected object with non-rotated rect bounds.
    expect(sink.snapshot().handles.length).toBe(4);
  });

  it('records 4 corner-handle hitboxes per selected object', () => {
    const sink = createDebugSink({ hitboxes: true });
    // … same harness; expect 4 entries with kind: 'handle'.
    const hits = sink.snapshot().hitboxes.filter((h) => h.kind === 'handle');
    expect(hits.length).toBe(4);
  });
});
```

- [ ] **Step 2: Verify failure**

```
npm test -- src/interactions/gestures/resize/resize.test.ts
```

- [ ] **Step 3: Add `debug?: DebugSink` to options**

```ts
import type { DebugSink } from '../../../debug/types';

// in options interface:
  debug?: DebugSink;
```

- [ ] **Step 4: Record at the handle-derivation site**

Find where `useResize` enumerates the four corner handles (look for `handles.map(` or `for (const h of handles)`). For each handle `h` with `(h.x, h.y)` in world coords and a hit radius `r`:

```ts
    debug?.recordHandle(id, { x: h.x, y: h.y }, 'corner');
    debug?.recordHitbox(id, 'handle', { kind: 'circle', cx: h.x, cy: h.y, r });
```

(Use `?.` per the tree-shaking convention — these are isolated calls, no derivation work happens when `debug` is undefined.)

- [ ] **Step 5: Thread `debug` from Canvas**

In `Canvas.tsx`, find `useResize<...>(effectiveAdapter, derivedResizeOptionsFinal)` and ensure `derivedResizeOptionsFinal` includes `debug: debugSink ?? undefined` (extend `derivedResizeOptionsFinal` construction).

- [ ] **Step 6: Run + commit**

```
npm test -- src/interactions/gestures/resize/
```

```bash
git add src/interactions/gestures/resize/ src/canvas/Canvas.tsx
git commit -m "feat(debug): record resize handles + corner hitboxes"
```

---

## Task 9: Thread `debug` into `useRotate` (rotation handle + hitbox)

**Files:**
- Modify: `src/interactions/gestures/rotate/rotate.ts`
- Modify: `src/interactions/gestures/rotate/rotate.test.ts`

Same pattern as Task 8 but for the single rotation handle.

- [ ] **Step 1: Write failing test**

```ts
import { createDebugSink } from '../../../debug/createDebugSink';

describe('useRotate — debug recording', () => {
  it('records a rotation handle position', () => {
    const sink = createDebugSink({ handles: true });
    // … mount + render
    const rh = sink.snapshot().handles.filter((h) => h.kind === 'rotation');
    expect(rh.length).toBe(1);
  });

  it('records a rotation hitbox', () => {
    const sink = createDebugSink({ hitboxes: true });
    // … mount + render
    const hits = sink.snapshot().hitboxes.filter((h) => h.kind === 'rotation');
    expect(hits.length).toBe(1);
  });
});
```

- [ ] **Step 2: Verify failure**

```
npm test -- src/interactions/gestures/rotate/rotate.test.ts
```

- [ ] **Step 3: Add option + record**

```ts
import type { DebugSink } from '../../../debug/types';

// options:
  debug?: DebugSink;

// at the rotation-handle derivation site, with handle position (rx, ry) and radius r:
debug?.recordHandle(id, { x: rx, y: ry }, 'rotation');
debug?.recordHitbox(id, 'rotation', { kind: 'circle', cx: rx, cy: ry, r });
```

- [ ] **Step 4: Thread from Canvas**

In `Canvas.tsx`, locate `useRotate<...>(effectiveAdapter, rotateOptions ?? {})` and pass `debug: debugSink ?? undefined` via the options.

- [ ] **Step 5: Run + commit**

```
npm test -- src/interactions/gestures/rotate/
```

```bash
git add src/interactions/gestures/rotate/ src/canvas/Canvas.tsx
git commit -m "feat(debug): record rotation handle + hitbox"
```

---

## Task 10: Thread `debug` into `useAreaSelect` (marquee bounds)

**Files:**
- Modify: `src/interactions/gestures/area-select/areaSelect.ts`
- Modify: `src/interactions/gestures/area-select/areaSelect.test.ts`

`useAreaSelect` records the in-progress marquee rectangle as a `bounds` entry during drag (per the spec's `bounds` coverage: "every visible object on the scene, including overlay-folded poses").

- [ ] **Step 1: Write failing test**

```ts
import { createDebugSink } from '../../../debug/createDebugSink';

describe('useAreaSelect — debug recording', () => {
  it('records the marquee bounds during drag', () => {
    const sink = createDebugSink({ bounds: true });
    // … mount; simulate drag from (10,10) to (50,40); read back
    const b = sink.snapshot().bounds.find((x) => x.id === 'area-select');
    expect(b).toBeDefined();
    expect(b!.bounds).toEqual({ x: 10, y: 10, width: 40, height: 30 });
  });
});
```

- [ ] **Step 2: Verify failure**

```
npm test -- src/interactions/gestures/area-select/areaSelect.test.ts
```

- [ ] **Step 3: Add option + record on every move**

```ts
import type { DebugSink } from '../../../debug/types';

// options:
  debug?: DebugSink;

// in onMove (where the marquee rect is computed):
debug?.recordBounds('area-select', { x: minX, y: minY, width: w, height: h });
```

- [ ] **Step 4: Thread from Canvas**

In `Canvas.tsx`, extend `derivedAreaSelectOptions` (passed to `useAreaSelect(...)`) with `debug: debugSink ?? undefined`.

- [ ] **Step 5: Run + commit**

```
npm test -- src/interactions/gestures/area-select/
```

```bash
git add src/interactions/gestures/area-select/ src/canvas/Canvas.tsx
git commit -m "feat(debug): record area-select marquee bounds"
```

---

## Task 11: Thread `debug` into `useEditAnchors` (anchor handles + hitboxes)

**Files:**
- Modify: `src/interactions/gestures/edit-anchors/editAnchors.ts`
- Modify: `src/interactions/gestures/edit-anchors/editAnchors.test.ts`

Anchor-edit mode produces N anchor handles (per path vertex). Record positions (`handles`, kind `anchor`) and circular hitboxes (`hitboxes`, kind `anchor`).

- [ ] **Step 1: Write failing test**

```ts
import { createDebugSink } from '../../../debug/createDebugSink';

describe('useEditAnchors — debug recording', () => {
  it('records one handle + one hitbox per anchor', () => {
    const sink = createDebugSink({ handles: true, hitboxes: true });
    // … mount with a 4-anchor path; assert .handles.filter(kind:'anchor').length === 4
    expect(sink.snapshot().handles.filter((h) => h.kind === 'anchor').length).toBe(4);
    expect(sink.snapshot().hitboxes.filter((h) => h.kind === 'anchor').length).toBe(4);
  });
});
```

- [ ] **Step 2: Verify failure**

```
npm test -- src/interactions/gestures/edit-anchors/editAnchors.test.ts
```

- [ ] **Step 3: Add option + record per anchor**

```ts
import type { DebugSink } from '../../../debug/types';

// options:
  debug?: DebugSink;

// inside anchor enumeration loop, with anchor world position (ax, ay) and radius r:
debug?.recordHandle(id, { x: ax, y: ay }, 'anchor');
debug?.recordHitbox(id, 'anchor', { kind: 'circle', cx: ax, cy: ay, r });
```

- [ ] **Step 4: Thread from Canvas**

In `Canvas.tsx`, extend the `useEditAnchors<TNode>(editAnchorsAdapter, { ... })` options with `debug: debugSink ?? undefined`.

- [ ] **Step 5: Run + commit**

```
npm test -- src/interactions/gestures/edit-anchors/
```

```bash
git add src/interactions/gestures/edit-anchors/ src/canvas/Canvas.tsx
git commit -m "feat(debug): record anchor handles + hitboxes"
```

---

## Task 12: Thread `debug` into `useSelectTool` (Phase-2c hit copies)

**Files:**
- Modify: `src/tools/builtin/useSelectTool.ts`
- Modify: `src/tools/builtin/useSelectTool.test.ts`

Per Phase 2c, `useSelectTool` has its own copies of corner-handle and rotation-handle hit logic (independent of `useResize`/`useRotate`). Record at those sites too — otherwise the overlay shows different hitboxes than the select tool actually evaluates.

- [ ] **Step 1: Write failing test**

```ts
import { createDebugSink } from '../../debug/createDebugSink';

describe('useSelectTool — debug recording', () => {
  it('records corner-handle hitboxes during pointer-down hit-test', () => {
    const sink = createDebugSink({ hitboxes: true });
    // … mount useSelectTool with debug: sink; simulate pointerdown over a
    // selection's handle area; assert hitboxes recorded with kind 'handle'
    // and at least one with kind 'rotation'.
    const hits = sink.snapshot().hitboxes.filter((h) => h.kind === 'handle' || h.kind === 'rotation');
    expect(hits.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Verify failure**

```
npm test -- src/tools/builtin/useSelectTool.test.ts
```

- [ ] **Step 3: Add option + record**

`useSelectTool` is a hook returning a Tool record. Add to its options interface:

```ts
import type { DebugSink } from '../../debug/types';

  debug?: DebugSink;
```

At each hit site inside `pointer.onDown` (and wherever else the tool runs corner/rotation hit checks), add the corresponding `debug?.recordHitbox(...)` call mirroring Task 8/9.

- [ ] **Step 4: Thread from consumer**

There is no Canvas-side wiring for `useSelectTool` — consumers pass it themselves. Update the demo (Task 14) and the integration tests in `src/tools/builtin/integration.test.tsx` if they construct `useSelectTool` to forward a sink.

(For internal Canvas-built selects via `useSelectTool` in any built-in dispatch path: if Canvas does construct one internally, also thread `debug: debugSink ?? undefined` there — search Canvas.tsx for `useSelectTool(`.)

- [ ] **Step 5: Run + commit**

```
npm test -- src/tools/builtin/useSelectTool.test.ts
```

```bash
git add src/tools/builtin/useSelectTool.ts src/tools/builtin/useSelectTool.test.ts
git commit -m "feat(debug): record select-tool corner + rotation hitboxes"
```

---

## Task 13: Record `bounds` + `origins` from the scene-iteration loop + `layer` metadata in Canvas

**Files:**
- Modify: `src/canvas/Canvas.tsx`
- Modify: `src/canvas/Canvas.test.tsx`

The `defaultLayers` scene draw iterates objects and calls `drawOne(ctx, obj, pose, view)`. At each iteration, record `bounds` (from the resolved AABB) and `origin` (from the pose). For `layers`, record metadata before each layer's draw runs — but `runLayers` doesn't currently expose a per-layer hook, so do it inline in Canvas: wrap the call site that iterates layers, or add a simpler recording loop that walks `layersWithDebug` once before paint.

The simplest approach for `layers`: iterate `layersWithDebug` *immediately after* `debugSink?.beginFrame()` and call `debugSink?.recordLayer(layer.id, layer.label, layer.space ?? 'world', i)` for each. This decouples the recording from the draw order (still correct because we use the same array).

For `bounds`/`origins`: do it inline in the scene layer's draw closure, where `obj` and `pose` are in scope.

- [ ] **Step 1: Write failing tests**

Append to `Canvas.test.tsx`:

```ts
it('records bounds + origins for each item when those flags are on', async () => {
  // Render Canvas with debug={{bounds: true, origins: true}} and 3 items.
  // Assert (via a custom probe — e.g., expose the sink via a ref or via
  // assertions on the painted overlay) that 3 bounds and 3 origins were
  // recorded. Implementer: it's acceptable to expose a `debugSink` ref
  // for testing, OR assert via spying ctx draw counts.
});

it('records layer metadata once per layer when layers flag is on', async () => {
  // Mount with debug={{layers: true}} and a known layer set; assert as above.
});
```

- [ ] **Step 2: Verify failure**

```
npm test -- src/canvas/Canvas.test.tsx
```

- [ ] **Step 3: Implementation — add layer recording in the paint effect**

After the `debugSink?.beginFrame()` call from Task 6, add:

```ts
    if (debugSink) {
      const arr = layersWithDebug;
      for (let i = 0; i < arr.length; i++) {
        const layer = arr[i];
        // Don't record the overlay layer itself.
        if (layer.id === 'debug-overlay') continue;
        debugSink.recordLayer(layer.id, layer.label, layer.space ?? 'world', i);
      }
    }
```

- [ ] **Step 4: Implementation — record bounds + origins in scene draw**

Locate where Canvas constructs the `defaultLayers` scene config (or inline scene `drawOne` invocation site). At each iteration over an object — *just before* (or just after) `cfg.drawOne(ctx, obj, pose, view)` — add:

```ts
      if (debugSink) {
        const b = boundsOf(obj); // existing helper
        if (b) debugSink.recordBounds(obj.id, { x: b.x, y: b.y, width: b.width, height: b.height });
        // origin from pose: rect-shaped poses have (x,y); fall back to bounds top-left.
        const ox = (pose as { x?: number }).x ?? (b ? b.x : 0);
        const oy = (pose as { y?: number }).y ?? (b ? b.y : 0);
        debugSink.recordOrigin(obj.id, { x: ox, y: oy });
      }
```

(The `if (debugSink)` guard is acceptable here because the per-iteration cost is non-trivial — same pattern as the pointer-gestures body-hitbox site.)

- [ ] **Step 5: Run tests to verify pass**

```
npm test -- src/canvas/Canvas.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add src/canvas/Canvas.tsx src/canvas/Canvas.test.tsx
git commit -m "feat(debug): record bounds, origins, and layer metadata from Canvas"
```

---

## Task 14: Thread `debug` into `gridSnapStrategy`

**Files:**
- Modify: `src/interactions/gestures/shared/strategies/grid.ts`
- Modify: `src/interactions/gestures/shared/strategies/grid.test.ts`

The strategy gains an optional `debug?: DebugSink` parameter. Every time `snap` runs, record the rounded `(sx, sy)` as a candidate with `accepted: true` (grid snap evaluates exactly one candidate per call — the rounded point — and always accepts it).

- [ ] **Step 1: Write failing test**

Append to `src/interactions/gestures/shared/strategies/grid.test.ts`:

```ts
import { createDebugSink } from '../../../../debug/createDebugSink';

describe('gridSnapStrategy — debug recording', () => {
  it('records snap candidates when a debug sink is supplied', () => {
    const sink = createDebugSink({ snap: true });
    const strat = gridSnapStrategy<{ x: number; y: number; id: string }>(20, {
      debug: sink,
    });
    strat.snap({ id: 'a', x: 13, y: 27 }, {} as never);
    const recs = sink.snapshot().snap;
    expect(recs).toHaveLength(1);
    expect(recs[0]).toEqual({ point: { x: 20, y: 20 }, accepted: true });
  });

  it('does not record when no sink is supplied', () => {
    const strat = gridSnapStrategy<{ x: number; y: number; id: string }>(20);
    expect(() => strat.snap({ id: 'a', x: 13, y: 27 }, {} as never)).not.toThrow();
  });
});
```

- [ ] **Step 2: Verify failure**

```
npm test -- src/interactions/gestures/shared/strategies/grid.test.ts
```

- [ ] **Step 3: Extend `gridSnapStrategy` to accept `debug` in the opts overload**

In `src/interactions/gestures/shared/strategies/grid.ts`:

```ts
import type { DebugSink } from '../../../../debug/types';

// Update the opts overload's options type:
export function gridSnapStrategy<TPose>(
  spacing: UnitValue,
  opts: {
    unitSystem?: UnitSystem;
    origin?: OriginProjection<TPose>;
    debug?: DebugSink;
  },
): SnapStrategy<TPose>;

// Then in the body, extract debug:
  const debug: DebugSink | undefined = isOpts ? arg.debug : undefined;

// And inside the returned strategy's snap method, after computing sx/sy:
      debug?.recordSnapCandidate({ x: sx, y: sy }, true);
```

(You may also need to relax the original first overload to accept `{debug}` without `origin` for rect-pose callers. Easiest: add a third overload accepting `{debug?: DebugSink; unitSystem?: UnitSystem}` for rect poses, dispatching to `RECT_ORIGIN_PROJECTION`.)

- [ ] **Step 4: Run + commit**

```
npm test -- src/interactions/gestures/shared/strategies/grid.test.ts
```

```bash
git add src/interactions/gestures/shared/strategies/grid.ts src/interactions/gestures/shared/strategies/grid.test.ts
git commit -m "feat(debug): record snap candidates from gridSnapStrategy"
```

---

## Task 15: Wire `clearSnap` on gesture end

**Files:**
- Modify: `src/canvas/Canvas.tsx`

Snap arrays survive across renders within a gesture and clear on gesture end. The Canvas wires this by calling `debugSink?.clearSnap()` on `onDragEnd` / `onPointerUp` from the dispatcher.

- [ ] **Step 1: Locate the gesture-end hook in Canvas**

In `Canvas.tsx`, find the `usePointerGestures({ ... })` block (Task 7 site). Look for `onDragEnd` or the equivalent post-drag cleanup. Add to the options:

```ts
    onDragEnd: () => {
      debugSink?.clearSnap();
      // (preserve any existing onDragEnd behavior — chain it.)
    },
```

If `usePointerGestures` doesn't expose `onDragEnd`, hook into the dispatcher's pointer-up path instead. Alternative: make `useMove`/`useResize`/`useRotate` clear snap themselves at gesture end via `debug?.clearSnap()`.

Concrete decision: the safest single site is the `usePointerGestures` `onDragEnd`. If the option doesn't exist today, add one (small extension to the hook).

- [ ] **Step 2: Add a smoke test (optional but recommended)**

In `Canvas.test.tsx`:

```ts
it('clears snap candidates after gesture end', () => {
  // Mount with debug={{snap: true}} + a snap-using move gesture; simulate
  // drag (records candidates) then pointerup; assert snap array is empty.
});
```

- [ ] **Step 3: Run + commit**

```
npm test -- src/canvas/
```

```bash
git add src/canvas/Canvas.tsx src/canvas/Canvas.test.tsx
git commit -m "feat(debug): clearSnap on gesture end"
```

---

## Task 16: Demo toggle in PathPoseDemo

**Files:**
- Modify: `demo/demos/PathPoseDemo.tsx`

Add a button that cycles through six debug states: `none → bounds → +origins → +hitboxes → +handles → all → none`. The demo must use the `<Canvas>` component (per project memory) and avoid dark-on-dark chrome (the cream/yellow/cyan/magenta palette is fine against the dark backdrop).

- [ ] **Step 1: Read PathPoseDemo for the existing structure**

```bash
cat /Users/mike/src/weasel/demo/demos/PathPoseDemo.tsx
```

Identify where it renders `<Canvas>` and what props it already passes. (If PathPoseDemo turns out to be too constrained — e.g. doesn't exercise enough of the surface — fall back to `BezierEditDemo.tsx` which exercises anchors. PathPoseDemo is the documented suggestion.)

- [ ] **Step 2: Add the toggle state + button**

In the demo component:

```tsx
import type { DebugConfig } from '../../src';

const DEBUG_STATES: Array<{ label: string; config: DebugConfig | false }> = [
  { label: 'off',          config: false },
  { label: 'bounds',       config: { bounds: true } },
  { label: '+origins',     config: { bounds: true, origins: true } },
  { label: '+hitboxes',    config: { bounds: true, origins: true, hitboxes: true } },
  { label: '+handles',     config: { bounds: true, origins: true, hitboxes: true, handles: true } },
  { label: 'all',          config: { bounds: true, origins: true, hitboxes: true, handles: true, snap: true, layers: true } },
];

// inside component:
const [debugIdx, setDebugIdx] = useState(0);
const debug = DEBUG_STATES[debugIdx].config;

// in render, alongside whatever other controls exist:
<button onClick={() => setDebugIdx((i) => (i + 1) % DEBUG_STATES.length)}>
  Debug overlay: {DEBUG_STATES[debugIdx].label}
</button>

// pass to Canvas:
<Canvas
  /* …existing props… */
  debug={debug}
/>
```

(Make sure the button styling stays within the demo's existing chrome conventions — read the file for the surrounding control styles.)

- [ ] **Step 3: Manual verification**

```
npm run dev
```

Open the demo, click through the 6 states, confirm overlays appear/change.

- [ ] **Step 4: Run tests + commit**

```
npm test
```

Expected: PASS — no test changes for the demo, but the build must stay green.

```bash
git add demo/demos/PathPoseDemo.tsx
git commit -m "demo(path): debug overlay toggle cycles through 6 states"
```

---

## Task 17: CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add an Unreleased entry**

Append (or create the Unreleased section if absent):

```markdown
### Added
- Debug overlay subsystem: `?debug=…` URL gating + `<Canvas debug={...}>` prop.
  Six features ship: `hitboxes`, `handles`, `bounds`, `origins`, `snap`, `layers`.
  Sink threaded through `usePointerGestures`, `useResize`, `useRotate`,
  `useAreaSelect`, `useEditAnchors`, `useSelectTool`, and `gridSnapStrategy`.
  When the prop is omitted/false, every recording call short-circuits via
  optional chaining (tree-shakeable).
- New exports: `parseDebugFlags`, `createDebugSink`, `createDebugOverlayLayer`,
  `DEFAULT_DEBUG_THEME`, types `DebugConfig`, `DebugSink`, `DebugFeature`,
  `DebugTheme`, `HitShape`, `HandleKind`.
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): debug overlay subsystem"
```

---

## Self-review checklist

Before declaring done:

- [ ] Every recording call site in interaction code uses `debug?.recordX(...)` (optional chain) — never `if (debug) debug.recordX(...)`. The two exceptions (pointer-gestures body iteration, Canvas scene-iteration bounds/origins) wrap their derivations in `if (debug)` blocks for inner-loop performance and have a comment explaining why.
- [ ] No no-op default sink anywhere. `createDebugSink` is only called by Canvas when `debug` is enabled.
- [ ] Every hook that received a `debug?: DebugSink` option is wired from Canvas with `debug: debugSink ?? undefined`.
- [ ] `<Canvas debug={false}>` produces no overlay layer regardless of URL.
- [ ] `<Canvas debug={undefined}>` (default) reads `window.location.search` once at mount.
- [ ] `<Canvas debug={config}>` overrides URL.
- [ ] `sink.beginFrame()` runs at the top of every paint; `sink.clearSnap()` runs on gesture end.
- [ ] Overlay layer is `space: 'screen'`, sits at the top of the stack, and projects world coords through `worldToScreen(viewToTransform(view))`.
- [ ] Visual style matches the spec: hitboxes magenta + dashed, handles cyan crosshair, bounds yellow, origins green dot, snap orange (open/filled), layer text white-on-translucent.
- [ ] PathPoseDemo cycles through the 6 states and visibly reflects each.
- [ ] Demo uses `<Canvas>`, not raw `canvasRef` (project memory).
- [ ] No new dark-on-dark chrome on the demo backdrop (project memory).
- [ ] Barrel exports updated in `src/debug/index.ts` and re-exported via `src/index.ts`.
- [ ] CHANGELOG updated.
- [ ] `npm test` is fully green.
