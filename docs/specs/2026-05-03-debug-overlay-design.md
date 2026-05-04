# Debug Overlay Primitives — Design

**Status:** Approved 2026-05-03
**Depends on:** Tool primitive Phase 2c (`space: 'screen'` chrome infra, `View` with scale)
**Defers:** None — full surface in v1

## Goal

Ship a dev-mode visualization layer that exposes what the interaction system "sees": hitboxes, handle positions, AABB bounds, pose origins, snap targets, and layer-order metadata. Enable per-feature toggles via URL query param so deployed builds can flip it on without a rebuild. Zero overhead in prod when not used (tree-shaken or dead-code-eliminated).

## Motivation

Today, debugging a "why didn't this click register?" or "why is the rotation handle 4 px off?" problem means inserting `console.log` into the hot path, then reverting. There's no canonical way to see what the hit-test math is actually evaluating against the visual chrome. As Phase 2c lands zoom (and chrome flips to screen space), the visual / hit divergence will become harder to reason about by inspection alone — handles get tiny at small scale, bounds get sheared by stale `getBounds` overrides, etc.

This overlay solves the inner-loop debugging problem and doubles as a teaching tool for new consumers ("here's where the kit computes your handles").

## Design

### URL query param

`?debug=<feature>[,<feature>…]` enables the overlay. Features:
- `hitboxes` — body hit areas + handle hit circles
- `handles` — handle positions (independent of whether the selection layer is drawing them)
- `bounds` — AABB outline per object
- `origins` — dot at each pose `(x, y)`
- `snap` — snap-target candidates + chosen target during drag
- `layers` — text annotations on each layer (id, label, `space`, z-index)
- `all` — shorthand for everything

Examples:
- `?debug=hitboxes` — just hitboxes
- `?debug=bounds,origins` — bounds and pose origins
- `?debug=all` — everything

The Canvas reads the query param once at mount via `parseDebugFlags(window.location.search)`. The result is stored in a `DebugConfig` and passed down via React context. Consumers who want to override (force-on for tests, force-off in production regardless of URL) pass a `debug` prop on `<Canvas>`:

```tsx
<Canvas debug={{ hitboxes: true, bounds: true }} … />
<Canvas debug={false} … />  // explicit off, ignore URL
<Canvas … />                  // default: read URL
```

### Side-channel architecture

Each interaction hook that owns hit math accepts an optional `debug?: DebugSink`. When omitted (the default), the hook contains zero references to the sink — bundler tree-shakes the entire recording path.

```ts
export interface DebugSink {
  recordHitbox(id: string, kind: 'body' | 'handle' | 'rotation' | 'anchor', shape: HitShape): void;
  recordHandle(id: string, position: { x: number; y: number }, kind: HandleKind): void;
  recordBounds(id: string, bounds: Bounds): void;
  recordOrigin(id: string, point: { x: number; y: number }): void;
  recordSnapCandidate(point: { x: number; y: number }, accepted: boolean): void;
  recordLayer(id: string, label: string, space: 'world' | 'screen', index: number): void;
  /** Called by the Canvas at the start of each frame so sinks can clear stale data. */
  beginFrame(): void;
}

export type HitShape =
  | { kind: 'rect'; x: number; y: number; width: number; height: number; rotation?: number }
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'path'; d: Path2D };

export type HandleKind = 'corner' | 'rotation' | 'anchor';
```

### Tree-shaking discipline

The sink is read via `?.` everywhere:

```ts
// Inside useResize:
debug?.recordHandle(id, h, 'corner');
```

When `debug === undefined`, the optional-chain short-circuits and V8 (and the bundler's static analyzer) sees the call as unreachable. As long as no hook closes over `debug` in a way that escapes (e.g. assigning it to a non-local), tree-shaking works.

Two safeguards:
1. **A no-op default sink is NOT used.** Importing a no-op factory creates a real reference that anchors the recording paths. The optional-chain pattern is what enables elimination.
2. **Lint rule (follow-on):** disallow `if (debug) debug.record(...)` — must be `debug?.record(...)`. The if-form keeps the closure's `debug` reference alive across multiple statements; the optional-chain form is per-call.

### `createDebugSink` and the overlay layer

The Canvas owns one sink instance per mount, created lazily only when `debug` is enabled. The sink stores recorded primitives in arrays keyed by frame; the overlay layer renders from those arrays.

```ts
export function createDebugSink(config: DebugConfig): DebugSink & { snapshot(): DebugSnapshot };
```

The sink is wired:
- Into every interaction hook that accepts a `debug` param (Canvas threads `sink` through `usePointerGestures`, `useMove`, `useResize`, `useRotate`, `useAreaSelect`, `useEditAnchors`, `useSelectTool`).
- Into `runLayers` itself for the `layers` feature: before each layer runs, the Canvas calls `sink?.recordLayer(layer.id, layer.label, space, index)`.
- Into snap strategies: `gridSnapStrategy(opts, debug?)` (and any other snap strategies) call `recordSnapCandidate` for each candidate they evaluate.

The Canvas adds one extra `RenderLayer` at the very top of the stack — `createDebugOverlayLayer({ sink, config })` — with `space: 'screen'`. Its `draw` reads the sink's snapshot and paints:
- Hitboxes as semi-transparent magenta fills with dashed outlines.
- Handles as 1-px crosshairs in cyan.
- Bounds as thin yellow outlines.
- Origins as 3-px dots in green.
- Snap candidates as small circles (open = considered, filled = chosen) in orange.
- Layer annotations as a small column in the canvas's top-right corner with `[i] id (space)` per row.

Each feature is independently rendered based on its flag in `config`.

### Per-feature semantics — what gets recorded where

#### hitboxes

Recorded sites:
- `usePointerGestures` body hit-test: `recordHitbox(id, 'body', { kind: 'rect', ...bounds, rotation })` for every object considered (the same set the hit-test iterates).
- `useResize`/`useSelectTool` corner-handle hits: `recordHitbox(id, 'handle', { kind: 'circle', cx, cy, r: handleHitRadius / scale })` per handle.
- `useRotate`/`useSelectTool` rotation-handle hit: `recordHitbox(id, 'rotation', { kind: 'circle', ... })`.
- `useEditAnchors` anchor hits: `recordHitbox(id, 'anchor', { kind: 'circle', ... })`.

Coverage scope: every hit area the kit can produce a click on. Visualizes the *radius* you'd need to click within, not just the visual handle size — the two will diverge after the Phase 2c screen-px flip.

#### handles

Recorded by `useResize` (corner positions) and `useRotate` (rotation handle position) on every relevant render. Independent of the selection-overlay layer's drawing — useful when the overlay is suppressed (e.g. anchor-edit mode hides corner handles) but you still want to see where they'd be.

Coverage: corner handles, rotation handle, and (when in anchor-edit mode) per-anchor handles. Includes group/multi-select handles when those resolve to a single bounds.

#### bounds

Recorded by the scene-iteration loop in `defaultLayers`/Canvas — for each object drawn, the AABB derived from its pose + the configured `getBounds` is recorded. Catches:
- Bad `getBounds` overrides (visualized AABB doesn't enclose the object).
- Stale rotated-AABB math.
- Group-bounds union errors (recording the group's resolved bounds plus each child's bounds shows where the union is wrong).

Coverage: every visible object on the scene, including overlay-folded poses (move ghost, resize ghost). When a move/resize overlay is active, the live overlay pose's bounds are recorded — so you see the moving target's bounds, not the stored one.

#### origins

Recorded alongside bounds — the pose `(x, y)` for rect poses, the first contour's first vertex for path poses, and the centroid (or explicit `origin` field if defined) for any future pose type that ships an origin descriptor. Critical for path poses where the AABB origin and the pose origin diverge, and for snap-debugging (snap strategies operate on origins by default).

Coverage: every visible object, plus virtual-group resolved origins (the union AABB's top-left).

#### snap

Recorded by snap strategies during a drag. The kit's snap strategy interface gains an optional `debug?: DebugSink` parameter; `gridSnapStrategy` (the only built-in today) records every cell-corner candidate it evaluates and tags the chosen one. Cleared per-gesture by the Canvas calling `sink.beginFrame()` between move events.

Coverage: every snap candidate considered during the active drag. Future snap strategies (object-edge snap, guideline snap) follow the same convention.

#### layers

Recorded by the Canvas's render loop before each layer's draw. Feeds the top-right text column in the overlay. Catches:
- A layer registered in the wrong order (you see the index numbers).
- A layer that should be `'screen'` but is drawn `'world'` (or vice versa).
- A layer that's visible-but-empty (recorded but its draw produced nothing visible).

Coverage: every layer in the active stack, including those tagged `alwaysOn` and those gated by visibility.

### Frame lifecycle

Each Canvas render:
1. If `sink` exists, call `sink.beginFrame()` — clears all recorded arrays.
2. Run interaction hooks (which record into the sink as they execute hit math).
3. Run `runLayers` (records layer metadata + invokes scene draw, which records bounds/origins).
4. The debug-overlay layer reads the populated snapshot and paints in screen space.

Snap recording happens at gesture time (pointer-move events), not on every render — the strategy calls `recordSnapCandidate` directly. The snapshot retains snap data across frames within a gesture and clears at gesture end (the Canvas wires `onDragEnd` to a sink-side `clearSnap()`).

### Performance

The overlay is dev-mode opt-in. With `debug` undefined, every recording call is `undefined?.recordX(...)` — short-circuits before evaluating args. With `debug` enabled, each recording call costs an array push and the overlay paints O(n) primitives per frame. For scenes with thousands of objects, the overlay slows the frame, but that's acceptable for a debug tool.

No memoization or batching in v1 — keep the implementation transparent. If frame budget becomes a concern, add a `maxRecords` cap per feature.

### Visual style

Color palette (high contrast against the demo's dark backdrop):
- Hitboxes: `rgba(255, 0, 255, 0.25)` fill, `#ff00ff` 1-px dashed outline
- Handles: `#00e5ff` 1-px crosshair (8-px arms)
- Bounds: `#ffeb3b` 1-px solid outline
- Origins: `#69f0ae` 3-px filled circle
- Snap candidates: `#ffa726` 4-px open circle (considered) or filled circle (chosen)
- Layer annotations: 11-px monospace, `#e0e0e0` on `rgba(0,0,0,0.6)` background

Configurable via a `theme?: Partial<DebugTheme>` on `DebugConfig` for consumers with different backgrounds.

## Testing surface

**Unit**
- `parseDebugFlags`: every feature key, `all`, comma-separated, missing param, malformed input.
- `createDebugSink`: records under each feature flag; ignores records when feature flag is off.
- `beginFrame` clears non-snap arrays; snap arrays clear on `clearSnap()`.

**Integration**
- Mount Canvas with `debug={{ bounds: true }}` and a 3-object scene; assert the overlay layer's draw produced 3 stroke calls in yellow.
- Mount with `?debug=hitboxes` (mocked URL); assert hitbox records appear after a hover-equivalent render.
- Mount with `debug={false}` and `?debug=all`; assert no overlay layer registered (explicit off wins).
- Tree-shaking smoke: a fixture file that imports just `useResize` (no `createDebugSink`) — assert via grep that the bundled output contains no `recordHandle`/`recordHitbox` strings. (Optional v1; punt to a CI follow-on if too brittle.)

**Visual / demo**
- Add a "Debug Overlay" toggle to one existing demo (probably PathDemo, which exercises non-rect poses, group bounds, and rotation). Toggle cycles through `none → bounds → +origins → +hitboxes → +handles → all → none`.

## Out of scope

- **Persisting overlay state across reloads** beyond the URL param. (Just bookmark the URL.)
- **Recording history / playback.** (Use browser devtools.)
- **Performance profiling overlays** (frame time, layer cost). Separate concern; possibly a future feature flag.
- **Custom feature plugins.** All six features ship in core; consumers can wrap or extend later if needed.
- **Lint rule for `if (debug)` vs `debug?.`** — track as a follow-on; the convention is documented and ESLint can enforce later.

## Open questions resolved

- **Data source:** side channel via optional `DebugSink` parameter, not re-running hit math.
- **Gating:** URL query param (`?debug=…`) primary; `debug` prop on Canvas is the override (force on/off, ignores URL).
- **No-op fallback:** none. `debug?.recordX(...)` everywhere; the absence of a default sink is what enables tree-shaking.
- **Coverage in v1:** all six features (hitboxes, handles, bounds, origins, snap, layers).
- **Sink lifecycle:** one per Canvas mount; cleared per-frame; snap data cleared per-gesture.
