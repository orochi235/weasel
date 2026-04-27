# Capabilities — Design Spec

**Date:** 2026-04-27
**Status:** Draft (unattended Claude default — review before implementation)
**Depends on:** Plans 1–4 (foundation, state/store, Lab/Workspace shells, schema-driven config)
**Builds toward:** v0.1 release (no further plans needed after Plan 5)
**Package paths:** `src/canvas/`, `src/layers/`, `src/dragdrop/`, `src/undo/`, plus `@labkit/react/canvas`, `@labkit/react/layers` exports

---

## 1. Summary

Plan 5 wires up the four opt-in capability fields on `Instrument` — `canvas`, `layers`, `dragDrop`, and `undo` — and ships the primitives they depend on: `<CanvasStack>`, `<LayerList>`, `UndoStack`, and the system-event bus. It also makes `<ScaleIndicator>` (shipped inert in Plan 1) zoom-aware when nested inside a `<CanvasStack>`.

Each capability is detected by the Workspace runtime at mount time by inspecting the active Instrument object. When a capability is present the Workspace mounts the appropriate chrome (canvas area, layer panel, drag palette, undo/redo toolbar buttons) and wires the runtime plumbing (event emission, snapshot scheduling, drag pipeline).

This subsystem is split into five sub-plans (5a–5e) that can be implemented mostly in order, but 5b–5d can proceed in parallel after 5a ships because they only need the types, not the canvas render loop.

---

## 2. Capability Discovery

The Workspace runtime inspects the active `Instrument` immediately after mount and after any instrument-switch. Discovery is a pure synchronous check — no dynamic imports, no async.

```ts
// Workspace runtime pseudo-logic (implementation detail, not a public API)
const caps = {
  hasCanvas:   instrument.canvas   != null,
  hasLayers:   instrument.layers   != null,
  hasDragDrop: instrument.dragDrop != null,
  hasUndo:     instrument.undo     != null,
};
```

**Chrome decisions driven by capability presence:**

| Capability present | Chrome added |
|---|---|
| `canvas` | `<CanvasStack>` fills the main content area |
| `canvas` absent, `render` present | `instrument.render(ctx)` fills the main content area |
| `layers` | `<LayerList>` panel in the Workspace sidebar |
| `dragDrop` | Palette section in the Workspace sidebar |
| `undo` | Undo / Redo toolbar buttons become active |

No capability present + no `render` field is a TypeScript error enforced by `defineInstrument` (at least one of `render` or `canvas` must be supplied).

**CLAUDE'S DEFAULT:** Capability detection is eager and synchronous at mount. A deferred/lazy approach (detect on first interaction) was considered but adds complexity with no clear benefit at v0 scale.

---

## 3. Canvas Capability

### 3.1 CanvasStack Primitive

`<CanvasStack>` is a multi-layer canvas with pan/zoom. It is ported from `garden-planner/src/canvas/CanvasStack.tsx` (and surrounding files). The port removes garden-planner-specific layer renderers (planting, structure, zone) but keeps the pan/zoom core, the per-layer dirty-flag scheduling, the device-pixel-ratio handling, and the hit-testing machinery.

**Implementer research task:** Before writing any code, read `~/src/eric/src/canvas/CanvasStack.tsx` and all files it imports (`usePanZoom`, `useLayerScheduler`, canvas utility helpers, etc.). Understand the internal draw loop and interaction model, then write a clean-room port into `src/canvas/`. Do not copy files verbatim.

#### Public API

```tsx
interface CanvasStackProps {
  layers: CanvasLayerDescriptor[];       // ordered; bottom-first
  view: ViewTransform;                   // controlled: zoom + pan
  onViewChange: (v: ViewTransform) => void;
  width?: number | string;               // default "100%"
  height?: number | string;              // default "100%"
  className?: string;
  onHitTest?: (worldPos: Point) => void; // pointer-up fires this
  children?: React.ReactNode;            // overlaid absolutely-positioned elements
}

interface CanvasLayerDescriptor {
  id: string;
  visible: boolean;
  render: (ctx: CanvasRenderingContext2D, view: ViewTransform) => void;
}

interface ViewTransform {
  zoom: number;
  pan: { x: number; y: number };
}

interface Point { x: number; y: number; }
```

`<CanvasStack>` provides a `CanvasStackContext` (see §8) that `<ScaleIndicator>` reads.

#### Internal Layer Scheduling

**CLAUDE'S DEFAULT:** Each layer renders onto its own `<canvas>` element stacked with `position: absolute`. Layers are re-rendered independently when their inputs change. A dirty-flag ref per layer gates re-render: when `view` changes, all visible layers are marked dirty; when only `state` changes, only the layers whose `render` function reference changed are marked dirty. The draw loop uses `requestAnimationFrame` coalescing so at most one frame is drawn per rAF callback.

Alternative (single canvas, composite every frame) is simpler but prevents partial redraws — rejected for performance.

#### Pan/Zoom Interaction

**CLAUDE'S DEFAULT:**
- Mouse wheel → zoom around cursor (deltaY → zoom factor, configurable sensitivity)
- Click-drag on background → pan
- Two-finger pinch on touch → zoom + pan simultaneously
- Both wheel and touch gesture support are included at v0

`onViewChange` is called on every frame during an active gesture (not debounced), so the controlled parent (Workspace runtime) must store view in a ref-plus-state pattern to avoid dropped frames.

#### High-DPI / Device Pixel Ratio

**CLAUDE'S DEFAULT:** `<CanvasStack>` reads `window.devicePixelRatio` on mount and on `resize` events. Canvas backing store is scaled by DPR; CSS dimensions remain logical pixels. The `ViewTransform` always uses logical-pixel coordinates — the DPR scaling is internal to `<CanvasStack>` and invisible to layer renderers.

#### Hit-Testing Contract

The `CanvasCapability.hitTest` function has signature `(state: TS, worldPos: Point) => HitResult | null`. `HitResult` is an open-ended object (`{ id: string; [key: string]: unknown }`).

`<CanvasStack>` converts pointer events from screen coordinates to world (logical canvas) coordinates by inverting the current `ViewTransform`, then calls the capability's `hitTest`. Results are passed up via `onHitTest`. The Workspace runtime does not interpret `HitResult`; it is purely passed to `pickUp` (dragDrop capability, §5) or to `instrument.render` overlay children.

```ts
interface HitResult {
  id: string;
  [key: string]: unknown;
}
```

### 3.2 CanvasCapability Interface (from design spec §5)

```ts
interface CanvasCapability<TS, TC> {
  layers?: CanvasLayer<TS, TC>[];
  render?: (ctx: CanvasRenderingContext2D, state: TS, config: TC) => void;
  initialView?: ViewTransform;
  hitTest?: (state: TS, worldPos: Point) => HitResult | null;
}

interface CanvasLayer<TS, TC> {
  id: string;
  label: string;
  render: (ctx: CanvasRenderingContext2D, state: TS, config: TC, view: ViewTransform) => void;
  alwaysOn?: boolean;
}
```

The Workspace runtime adapts `CanvasLayer<TS, TC>` → `CanvasLayerDescriptor` by closing over the current `state` and `config`.

### 3.3 View Synchronization with Plan 2 Store

The `WorkspaceRecord.view` field (Plan 2) is the single source of truth for `zoom` and `pan`. The Workspace runtime:
1. Passes `workspaceRecord.view` as the controlled `view` prop to `<CanvasStack>`.
2. Calls `store.setView(workspaceId, v)` in `onViewChange`.
3. Also exposes `{ zoom, setZoom }` on `RenderContext.workspace` for imperative control from instruments.

**CLAUDE'S DEFAULT:** `pan` is not exposed directly on `RenderContext.workspace` at v0 — only `zoom` is. This matches the design spec. Instruments that need direct pan control use the `initialView` field on `CanvasCapability` or wire up overlay children with custom controls.

---

## 4. Layers Capability

### 4.1 LayerList Primitive

```tsx
interface LayerListProps {
  layers: LayerDescriptor[];
  onReorder: (newOrder: LayerDescriptor[]) => void;
  onToggle: (id: string, visible: boolean) => void;
  className?: string;
}

interface LayerDescriptor {
  id: string;
  label: string;
  visible: boolean;
  alwaysOn?: boolean;   // if true: checkbox hidden, always rendered as checked
}
```

Visual: each row has a visibility checkbox (hidden when `alwaysOn`) and a label. Rows are drag-reorderable. `alwaysOn` rows cannot be hidden; their checkbox is replaced with a lock icon.

#### Drag-to-Reorder UX

**CLAUDE'S DEFAULT:** Uses pointer events (not HTML5 DnD) for drag-to-reorder, for two reasons: (1) HTML5 DnD has poor touch support; (2) HTML5 DnD conflicts with the canvas drag-drop pipeline (§5) if both are active simultaneously on the same page.

Implementation: `pointerdown` on a row activates drag mode; `pointermove` tracks cursor offset and reorders items in real time (live preview, not ghost image); `pointerup` commits. A drag handle icon on each non-`alwaysOn` row is the hit target.

**CLAUDE'S DEFAULT:** `alwaysOn` rows are not reorderable — they are visually pinned to the bottom of the list. The implementer may choose to pin them to top or bottom; bottom is the default here.

### 4.2 LayerCapability Interface (from design spec §5)

```ts
interface LayerCapability<TS, TC> {
  source?: 'canvas' | ((state: TS, config: TC) => LayerDescriptor[]);
}
```

When `source === 'canvas'` (or omitted, which defaults to `'canvas'` when a `canvas` capability is also present), the Workspace runtime derives `LayerDescriptor[]` from `instrument.canvas.layers`, using the layer `id`, `label`, `alwaysOn` fields and the per-workspace layer visibility state from the Plan 2 store.

When `source` is a function, the runtime calls it with current `state` and `config` on each render to get the `LayerDescriptor[]`. This supports instruments with dynamic layer lists (e.g., user-created layers).

**CLAUDE'S DEFAULT:** Layer visibility state is stored in `WorkspaceRecord` alongside `view` (Plan 2 store). It is a `Record<layerId, boolean>` map. Initial values: all layers start visible.

### 4.3 Events Emitted

- `layers.reorder` — emitted by Workspace runtime after `onReorder` fires
- `layers.toggle` — emitted after `onToggle` fires

Both are `SystemEvent` values. If `undo.snapshotOn` includes either, a snapshot is taken (§6).

---

## 5. DragDrop Capability

### 5.1 DragDropCapability Interface (from design spec §5)

```ts
interface DragDropCapability<TS, TC> {
  palette: PaletteItem[] | ((state: TS) => PaletteItem[]);
  onDragOver?: (pos: Point, dragged: PaletteItem, state: TS, config: TC) => DragFeedback | null;
  onDrop: (pos: Point, dragged: PaletteItem, state: TS, config: TC) => TS;
  pickUp?: (pos: Point, state: TS) => { item: PaletteItem; state: TS } | null;
}

interface PaletteItem {
  id: string;
  label: string;
  icon?: string;         // URL or data URI; optional
  data?: unknown;        // payload forwarded to onDrop
}

interface DragFeedback {
  valid: boolean;        // true = green highlight, false = red/forbidden
  label?: string;        // optional tooltip text shown during drag
}
```

### 5.2 Palette Rendering

When `dragDrop` capability is present, the Workspace sidebar renders a palette section above any `<LayerList>`. The palette displays `PaletteItem[]` as a grid or list of draggable tiles.

**CLAUDE'S DEFAULT:** Palette layout is a 2-column grid of icon+label tiles. When `palette` is a function, it is called with current `state` on every render (lightweight — implementations should memoize heavy computation themselves).

### 5.3 Drag-from-Palette → Drop-on-Canvas Pipeline

The drag pipeline runs entirely via pointer events to avoid HTML5 DnD conflicts with `<LayerList>` (§4.1).

1. `pointerdown` on a palette tile starts a drag. A ghost image follows the cursor.
2. While over `<CanvasStack>`, screen coordinates are converted to world coordinates via the current `ViewTransform`.
3. On each `pointermove` over canvas: `onDragOver(worldPos, item, state, config)` is called. If it returns `DragFeedback`, the canvas renders a visual overlay (highlight color based on `valid`). **CLAUDE'S DEFAULT:** The overlay is rendered as a fourth "drag feedback" layer in `<CanvasStack>` drawn above all instrument layers; it is managed entirely by the Workspace runtime, not by the instrument.
4. `pointerup` over canvas: `onDrop(worldPos, item, state, config)` is called; returned state replaces current state. Workspace runtime emits `canvas.itemAdded`.
5. `pointerup` outside canvas: drag cancelled, no state change.

**CLAUDE'S DEFAULT:** Drag feedback calls are throttled to one per animation frame (rAF) to avoid hammering `onDragOver` at pointer rate.

### 5.4 pickUp — Drag-from-Canvas

When `pickUp` is defined: `pointerdown` on the canvas fires `hitTest` (§3.1). If `hitTest` returns a `HitResult`, the Workspace runtime calls `pickUp(worldPos, state)`. If `pickUp` returns non-null, the returned `item` becomes the active drag item (as if dragged from the palette) and the returned `state` replaces current state (the item has been removed from canvas state). Workspace runtime emits `canvas.itemRemoved`.

The subsequent drag follows the normal drop pipeline (step 2–5 above).

**CLAUDE'S DEFAULT:** `pickUp` and `onDrop` are not composed automatically — if the user drags an item from canvas and drops it back on canvas, both `canvas.itemRemoved` and `canvas.itemAdded` are emitted. The undo stack will have two entries unless `snapshotOn` is configured carefully. This is acceptable at v0; coalescing is an open decision (§11).

### 5.5 Events Emitted

- `canvas.itemAdded` — after a successful `onDrop`
- `canvas.itemRemoved` — after a successful `pickUp`

---

## 6. Undo Capability

### 6.1 UndoCapability Interface (from design spec §5)

```ts
interface UndoCapability<TS, TC> {
  snapshotOn: SystemEvent[];
  snapshot?: (state: TS, config: TC) => unknown;
  restore?: (data: unknown, current: { state: TS; config: TC }) => { state: TS; config: TC };
  maxDepth?: number; // default 50
}
```

### 6.2 UndoStack Data Structure

`UndoStack` is a pure, immutable-style data structure with no React dependencies. It is unit-testable in isolation.

```ts
interface UndoStack {
  past: unknown[];     // oldest at index 0; bounded by maxDepth
  future: unknown[];   // most-recent-undone at index 0
}

// Pure functions (not methods — implementer may choose class or module):
function pushSnapshot(stack: UndoStack, snapshot: unknown, maxDepth: number): UndoStack;
function undo(stack: UndoStack): { stack: UndoStack; snapshot: unknown } | null;
function redo(stack: UndoStack): { stack: UndoStack; snapshot: unknown } | null;
function clearUndo(stack: UndoStack): UndoStack;
```

**Depth eviction:** **CLAUDE'S DEFAULT:** FIFO eviction — when `past.length === maxDepth` and a new snapshot is pushed, the oldest entry (`past[0]`) is dropped. No snapshot compression.

**Redo invalidation:** Pushing a new snapshot clears `future` entirely (standard undo/redo behavior).

### 6.3 Default Snapshot Behavior

When `undo.snapshot` is not provided: snapshot = `structuredClone(state)`.
When `undo.restore` is not provided: restore sets `state` to the snapshot, leaves `config` unchanged.

**CLAUDE'S DEFAULT:** Config is not snapshotted by default. An instrument can opt in by providing custom `snapshot`/`restore` that capture both. This avoids surprising behavior where undo changes config values the user set via controls.

### 6.4 Async State Changes

**CLAUDE'S DEFAULT:** Undo snapshots are taken synchronously at the moment the triggering event fires. If an instrument performs async operations (e.g., fetching data after a drop), the snapshot captures pre-async state. The instrument is responsible for emitting a second event when async work completes if it wants a second snapshot. The library does not provide async snapshot deferral at v0.

### 6.5 Toolbar Integration

When `undo` capability is present, the Workspace toolbar's Undo and Redo buttons (shipped inert in Plan 3) become active. The Workspace runtime:
- Disables Undo when `undoStack.past.length === 0`
- Disables Redo when `undoStack.future.length === 0`
- On Undo click: calls `undo(stack)`, calls `restore(snapshot, current)`, updates state/config, updates stack in Plan 2 store
- On Redo click: calls `redo(stack)`, same restore flow

**UndoStack is session-only** — not persisted (per design spec §7 `WorkspaceRecord`).

---

## 7. System Event Emission

### 7.1 SystemEvent Discriminated Union (from design spec §7)

```ts
type SystemEvent =
  | 'state.change'
  | 'config.change'
  | `config.change:${string}`    // template literal for specific key
  | 'layers.reorder'
  | 'layers.toggle'
  | 'canvas.itemAdded'
  | 'canvas.itemRemoved'
  | string;                      // custom events via ctx.emit
```

### 7.2 Who Emits

The Workspace runtime emits system events. Instruments do not emit events directly via import — they use `ctx.emit(eventName)` from `RenderContext`. Custom event names are arbitrary strings; the convention is `domain.action` (e.g., `'grid.subdivided'`).

**CLAUDE'S DEFAULT:** System events are emitted even when the `undo` capability is absent — the event bus is always live. Listeners are the undo runtime (if present) and any future capability that subscribes. This means instruments can safely call `ctx.emit(...)` regardless of whether undo is configured.

### 7.3 Event Bus Implementation

**CLAUDE'S DEFAULT:** The event bus is a lightweight synchronous pub/sub within the per-Lab Zustand store (Plan 2). It is not a global event emitter. Events fire synchronously in the call stack of the action that triggered them. No async dispatch, no batching at the event-bus level.

The bus is an implementation detail. Public surface:
- `ctx.emit(event)` on `RenderContext` — for instruments
- `undo.snapshotOn: SystemEvent[]` — for declaring subscriptions
- System events are named constants exported from `@labkit/react/state` for type-safe use in `snapshotOn` arrays

### 7.4 Listener Registration

The Workspace runtime registers one listener per `snapshotOn` entry when it mounts the undo capability. Listeners are removed on unmount or instrument switch. No memory leak risk from stale listeners.

---

## 8. ScaleIndicator Integration

`<ScaleIndicator>` was shipped in Plan 1 with a static `zoom` prop (or defaulting to 1.0 if omitted). Plan 5 makes it zoom-aware when nested inside `<CanvasStack>`.

### 8.1 CanvasStackContext

`<CanvasStack>` provides a React context:

```ts
interface CanvasStackContextValue {
  view: ViewTransform;  // live, updated on every pan/zoom
}

const CanvasStackContext = React.createContext<CanvasStackContextValue | null>(null);
```

### 8.2 ScaleIndicator Lookup

`<ScaleIndicator>` is updated (Plan 5 task, not Plan 1 retrofit — implementation happens in Plan 5) to read from context when no explicit `zoom` prop is supplied:

```tsx
// Conceptual logic inside ScaleIndicator
const ctx = useContext(CanvasStackContext);
const effectiveZoom = props.zoom ?? ctx?.view.zoom ?? 1.0;
```

**Backwards compatibility:** Existing standalone `<ScaleIndicator zoom={z} />` usage is unaffected — explicit prop wins over context. When used outside `<CanvasStack>` with no prop, zoom defaults to 1.0 (same as Plan 1 behavior).

### 8.3 Usage Pattern

```tsx
<CanvasStack layers={...} view={view} onViewChange={setView}>
  {/* Absolutely-positioned overlay children */}
  <ScaleIndicator />   {/* picks up zoom from CanvasStackContext automatically */}
</CanvasStack>
```

The Workspace runtime places `<ScaleIndicator>` as a `<CanvasStack>` child overlay when `canvas` capability is present, so no explicit `zoom` prop is needed in the normal case.

---

## 9. Cross-Capability Interactions

This section documents how capabilities interact at runtime. These are not separate APIs — they are emergent behaviors of wiring §3–§7 together.

### 9.1 Drop → Undo Snapshot

1. User drops a palette item on canvas.
2. Workspace runtime calls `onDrop` → new state returned.
3. Runtime emits `canvas.itemAdded`.
4. If `undo.snapshotOn` includes `'canvas.itemAdded'`: `snapshot(state, config)` is called, result pushed to `UndoStack`.

### 9.2 pickUp → Undo Snapshot

1. User lifts an item from canvas.
2. Runtime calls `pickUp` → `{ item, state }` returned; state updated.
3. Runtime emits `canvas.itemRemoved`.
4. If `undo.snapshotOn` includes `'canvas.itemRemoved'`: snapshot pushed.

### 9.3 Layer Reorder → Undo Snapshot

1. User drags a layer row in `<LayerList>`.
2. `onReorder` fires; Workspace runtime updates layer order in Plan 2 store.
3. Runtime emits `layers.reorder`.
4. If `undo.snapshotOn` includes `'layers.reorder'`: snapshot pushed. The snapshot must include layer order if `undo.restore` is custom; by default only `state` is snapshotted (layer order lives in store, not instrument state).

**CLAUDE'S DEFAULT:** Default snapshot/restore does not include layer ordering because layer order is workspace chrome state, not instrument state. Instruments that treat layer order as semantically significant must provide custom `snapshot`/`restore`.

### 9.4 Undo Restores Canvas State; <CanvasStack> Re-renders

After `restore(snapshot, current)` returns new `{ state, config }`, the Workspace runtime updates the Plan 2 store. `<CanvasStack>` receives the new state through its layer `render` closures on the next animation frame — no special canvas-reset logic required.

### 9.5 Layers Source = 'canvas' + CanvasLayer Visibility

When `layers.source === 'canvas'`, the `<LayerList>` visibility toggles update a per-workspace `visibleLayers: Set<string>` in the Plan 2 store. `<CanvasStack>` receives this as the `visible` field on each `CanvasLayerDescriptor`. Toggling a layer visibility is O(1) and triggers only that layer's dirty flag.

### 9.6 DragDrop + Layers Coexist in Sidebar

Both palette (DragDrop) and `<LayerList>` (Layers) can appear simultaneously in the Workspace sidebar. **CLAUDE'S DEFAULT:** Palette renders above `<LayerList>` in the sidebar. The sidebar is a vertically-scrollable column. No collision between the two pointer-event drag implementations because palette drag is initiated on palette tiles (sidebar) and layer drag is initiated on layer rows (sidebar), and they use different drag state refs.

---

## 10. Testing Strategy

### 10.1 UndoStack (Pure Unit Tests)

`src/undo/undoStack.test.ts` — no React, no rendering:
- `pushSnapshot` with depth < maxDepth
- `pushSnapshot` with depth = maxDepth (evicts oldest)
- `pushSnapshot` clears future
- `undo` returns null on empty stack
- `redo` returns null when future is empty
- round-trip: push → undo → redo
- `clearUndo` resets both past and future

### 10.2 CanvasStack (DOM + Canvas Mock)

`src/canvas/CanvasStack.test.tsx`:
- Renders without crashing (canvas elements mounted)
- `onViewChange` called on synthetic wheel event
- `view` prop changes cause layer re-render (dirty-flag assertion via mock render fn call count)
- High-DPI: canvas `width`/`height` attributes = logical × DPR (mock `devicePixelRatio`)

### 10.3 LayerList (Component Tests)

`src/layers/LayerList.test.tsx`:
- Renders correct number of rows
- `alwaysOn` row: checkbox absent, lock icon present
- `onToggle` fires when checkbox clicked
- `onReorder` fires after pointer-drag sequence (simulate pointerdown + pointermove + pointerup)

### 10.4 DragDrop (Integration — Workspace + Instrument)

`src/dragdrop/dragDrop.test.tsx` (renders a minimal `<Lab>` with a test instrument):
- Palette items render in sidebar
- Drag from palette → canvas calls `onDrop` with correct world position
- `canvas.itemAdded` event emitted after drop
- `pickUp` + re-drop round-trip: `canvas.itemRemoved` + `canvas.itemAdded` emitted
- Undo after drop restores pre-drop state (integration with undo capability)

### 10.5 System Event Bus (Hook Test)

`src/undo/eventBus.test.ts`:
- Listener registered for `'canvas.itemAdded'` fires on `ctx.emit('canvas.itemAdded')`
- Listener not registered for other events does not fire
- Listener removed on cleanup does not fire after cleanup

### 10.6 Storybook Stories

- `CanvasStack.stories.tsx` — Default (single layer, pan/zoom), Multi-layer, With ScaleIndicator overlay
- `LayerList.stories.tsx` — Default, With alwaysOn item, Empty state
- Drag-lab example (`examples/drag-lab/`) serves as integration visual review (not a Storybook story — rendered as a standalone Vite example)

---

## 11. Open Decisions (CLAUDE'S DEFAULT — review)

1. **CanvasStack layer architecture:** Individual `<canvas>` elements per layer vs. single canvas recomposite. **CLAUDE'S DEFAULT:** One canvas per layer.

2. **High-DPI handling:** Read DPR on mount + resize. **CLAUDE'S DEFAULT:** Logical-pixel ViewTransform only; DPR is internal.

3. **Pan/zoom gesture support:** Wheel + touch pinch. **CLAUDE'S DEFAULT:** Both included at v0.

4. **LayerList drag implementation:** Pointer events vs. HTML5 DnD. **CLAUDE'S DEFAULT:** Pointer events, to avoid conflict with canvas DnD.

5. **alwaysOn layer position in LayerList:** Pinned top or bottom. **CLAUDE'S DEFAULT:** Bottom.

6. **DragOver feedback rendering:** Separate runtime-managed layer vs. instrument-owned overlay. **CLAUDE'S DEFAULT:** Runtime-managed overlay layer.

7. **DragOver throttling:** rAF-throttled. **CLAUDE'S DEFAULT:** Yes.

8. **UndoStack eviction policy:** FIFO vs. compression. **CLAUDE'S DEFAULT:** FIFO.

9. **Default snapshot scope:** State only, not config. **CLAUDE'S DEFAULT:** State only.

10. **Async state + undo:** No deferral — snapshot at event time. **CLAUDE'S DEFAULT:** Synchronous only at v0.

11. **Event emission when undo absent:** Events still emitted (no-op). **CLAUDE'S DEFAULT:** Always emit.

12. **pickUp + re-drop coalescing:** Are `itemRemoved` + `itemAdded` coalesced into one undo snapshot? **CLAUDE'S DEFAULT:** Not coalesced — two separate events, two potential snapshots. Instruments can configure `snapshotOn` to include only one if desired.

13. **Palette layout:** 2-column grid. **CLAUDE'S DEFAULT:** 2-column.

14. **Layer order in default undo snapshot:** Not included. **CLAUDE'S DEFAULT:** Layer order is chrome state, not instrument state; not snapshotted by default.

15. **CanvasStack public sub-API exposure (interaction hooks):** Not exposed at v0. **CLAUDE'S DEFAULT:** Follow design spec §13 open question; defer to v0.y.

---

## 12. Out of Scope (v0.2+)

- Diff-based snapshot compression (currently: `structuredClone` only)
- Async undo snapshot deferral
- Coalescing rapid `canvas.itemAdded`/`canvas.itemRemoved` events into a single undo entry
- Drag-to-resize pane layouts (WorkspaceGrid is fixed sqrt-tiling, per design spec)
- Plugin/extension registry for capabilities
- Named undo history (audit log / history panel)
- Multi-workspace shared canvas state
- Offscreen canvas rendering or web worker paint threads
- Accessibility (keyboard nav) for `<LayerList>` drag-to-reorder — deferred but noted
- Touch-specific palette drag UX (swipe-out from sidebar)
