# Labkit Plan 5 — Capabilities Subsystem

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the four opt-in capability bundles (`canvas`, `layers`, `dragDrop`, `undo`) and their supporting primitives (`<CanvasStack>`, `<LayerList>`, `UndoStack`). Wire `<ScaleIndicator>` to `CanvasStackContext`. Wire Workspace runtime to detect capabilities and mount chrome accordingly.

**Architecture:** Each sub-section (5a–5e) is largely independent after types are established. 5a (Canvas) should be implemented first; 5b–5d can proceed in parallel once types compile. 5e (ScaleIndicator integration) is a small retrofit on the Plan 1 primitive.

**Spec:** `/Users/mike/src/labkit/docs/superpowers/specs/2026-04-27-capabilities-design.md`

**Depends on:** Plans 1–4 merged and passing CI.

**Tech Stack:** Same as Plans 1–4. No new dependencies are introduced by this plan.

---

## File Structure After This Plan

```
src/
  canvas/
    CanvasStack.tsx
    CanvasStack.less
    CanvasStack.test.tsx
    CanvasStack.stories.tsx
    CanvasStackContext.ts
    usePanZoom.ts          # extracted hook (port from garden-planner)
    useLayerScheduler.ts   # extracted hook (port from garden-planner)
    canvasCoords.ts        # screen ↔ world coordinate conversion helpers
    canvasCoords.test.ts
    index.ts
  layers/
    LayerList.tsx
    LayerList.less
    LayerList.test.tsx
    LayerList.stories.tsx
    index.ts
  dragdrop/
    DragDropRuntime.tsx    # Workspace-internal; not a public primitive
    dragDrop.test.tsx      # integration test
    index.ts               # exports types only
  undo/
    undoStack.ts
    undoStack.test.ts
    eventBus.ts
    eventBus.test.ts
    index.ts
  instrument/
    capabilities.ts        # CanvasCapability, LayerCapability, DragDropCapability, UndoCapability types
    capabilityDetector.ts  # pure function: instrument → CapabilityFlags
    capabilityDetector.test.ts
  primitives/
    ScaleIndicator.tsx     # updated (Plan 1 file — add context lookup)
    ScaleIndicator.test.tsx # updated
```

---

## Section 5a: Canvas Capability

### Task 5a-1: Research the garden-planner CanvasStack source

**Files:** (none — read-only research)

- [ ] **Step 1: Read the source**

  Open and read each of the following files (implementer task — do not copy verbatim):
  - `~/src/eric/src/canvas/CanvasStack.tsx`
  - All files imported by `CanvasStack.tsx` (hooks, utilities, etc.)

  Document in a scratch comment or mental model:
  - How layers are stored and scheduled for re-render
  - How pan/zoom state is tracked (refs vs. state)
  - How DPR is applied to canvas backing store
  - How pointer/wheel events are handled
  - What public props `CanvasStack` currently exposes
  - Which parts are garden-planner-specific (must be removed in the port)

- [ ] **Step 2: Identify seam points**

  List the hooks/helpers that can be extracted cleanly:
  - `usePanZoom` — pan/zoom interaction and state
  - `useLayerScheduler` — dirty-flag rAF loop
  - `canvasCoords` — screen ↔ world conversion

  These become separate files in `src/canvas/`.

  No commit — this is a research task only.

---

### Task 5a-2: Coordinate conversion helpers

**Files:**
- Create: `src/canvas/canvasCoords.ts`
- Create: `src/canvas/canvasCoords.test.ts`

- [ ] **Step 1: Write `canvasCoords.ts`**

  Export two pure functions:
  - `screenToWorld(screenPos: Point, view: ViewTransform): Point`
  - `worldToScreen(worldPos: Point, view: ViewTransform): Point`

  `ViewTransform = { zoom: number; pan: { x: number; y: number } }`.
  World → screen: `screenX = worldX * zoom + pan.x`.
  Screen → world: inverse.

- [ ] **Step 2: Write `canvasCoords.test.ts`**

  Tests:
  - Identity: zoom=1, pan={0,0} → coords unchanged
  - Zoom only: zoom=2, pan={0,0} → screen coords doubled
  - Pan only: zoom=1, pan={10,20} → screen offset by pan
  - Round-trip: screenToWorld(worldToScreen(p, v), v) ≈ p (float tolerance)

- [ ] **Step 3: Run tests**

  `cd ~/src/labkit && npx vitest run src/canvas/canvasCoords.test.ts`
  Expected: all pass.

- [ ] **Step 4: Commit**

  ```bash
  git add src/canvas/canvasCoords.ts src/canvas/canvasCoords.test.ts
  git commit -m "5a: Add coordinate conversion helpers (screenToWorld, worldToScreen)"
  ```

---

### Task 5a-3: CanvasStackContext

**Files:**
- Create: `src/canvas/CanvasStackContext.ts`

- [ ] **Step 1: Write `CanvasStackContext.ts`**

  ```ts
  import React from 'react';
  import type { ViewTransform } from '../instrument/capabilities';

  export interface CanvasStackContextValue {
    view: ViewTransform;
  }

  export const CanvasStackContext =
    React.createContext<CanvasStackContextValue | null>(null);
  ```

  No tests needed — it's a context value with no logic.

- [ ] **Step 2: Commit**

  ```bash
  git add src/canvas/CanvasStackContext.ts
  git commit -m "5a: Add CanvasStackContext"
  ```

---

### Task 5a-4: usePanZoom hook

**Files:**
- Create: `src/canvas/usePanZoom.ts`

Port from garden-planner (research in Task 5a-1). Strip garden-planner-specific state. The hook must:
- Accept initial `ViewTransform`
- Return `{ view, onWheel, onPointerDown, onPointerMove, onPointerUp }` handler bag
- Call a provided `onViewChange(v: ViewTransform)` callback on each change
- Support wheel zoom (cursor-centered) and pointer-drag pan
- Support two-finger pinch zoom on touch (`pointerType === 'touch'`)

**CLAUDE'S DEFAULT:** See spec §3.1 for behavior. Both wheel and touch gestures included.

- [ ] **Step 1: Write `usePanZoom.ts`** (clean-room port)

- [ ] **Step 2: Manual smoke test** — no automated test for the hook in isolation (gesture simulation is painful without a full DOM; covered by `CanvasStack.test.tsx` in Task 5a-7).

- [ ] **Step 3: Commit**

  ```bash
  git add src/canvas/usePanZoom.ts
  git commit -m "5a: Add usePanZoom hook (port from garden-planner, no garden-specific deps)"
  ```

---

### Task 5a-5: useLayerScheduler hook

**Files:**
- Create: `src/canvas/useLayerScheduler.ts`

Port from garden-planner. The hook schedules layer redraws via `requestAnimationFrame`:
- Accepts `layers: CanvasLayerDescriptor[]` and a canvas-refs map
- Marks all layers dirty when `view` changes
- Marks a layer dirty when its `render` function reference changes
- Coalesces redraws into a single rAF callback
- Calls each visible dirty layer's `render(ctx, view)` in order (bottom-first)

```ts
interface CanvasLayerDescriptor {
  id: string;
  visible: boolean;
  render: (ctx: CanvasRenderingContext2D, view: ViewTransform) => void;
}
```

- [ ] **Step 1: Write `useLayerScheduler.ts`** (clean-room port)

- [ ] **Step 2: Commit**

  ```bash
  git add src/canvas/useLayerScheduler.ts
  git commit -m "5a: Add useLayerScheduler hook (rAF dirty-flag scheduler)"
  ```

---

### Task 5a-6: CanvasStack component

**Files:**
- Create: `src/canvas/CanvasStack.tsx`
- Create: `src/canvas/CanvasStack.less`

Public API (see spec §3.1):

```tsx
interface CanvasStackProps {
  layers: CanvasLayerDescriptor[];
  view: ViewTransform;
  onViewChange: (v: ViewTransform) => void;
  width?: number | string;
  height?: number | string;
  className?: string;
  onHitTest?: (worldPos: Point) => void;
  children?: React.ReactNode;
}
```

Implementation:
- Container `div.lk-canvas-stack` with `position: relative; overflow: hidden`.
- One `<canvas>` per layer, each `position: absolute; top: 0; left: 0`.
- Canvas backing store scaled by `window.devicePixelRatio` on mount and resize (`ResizeObserver`).
- Uses `usePanZoom` for interaction events; calls `onViewChange`.
- Uses `useLayerScheduler` for draw scheduling.
- Provides `CanvasStackContext` with current `view`.
- On `pointerup` (not during drag): calls `onHitTest` with world coords if provided.
- `children` rendered in a `div.lk-canvas-stack__overlay` (position: absolute, full-size, pointer-events: none by default — overlays opt in with their own pointer-events style).

- [ ] **Step 1: Write `CanvasStack.tsx`**

- [ ] **Step 2: Write `CanvasStack.less`**

  Minimal: `lk-canvas-stack` (relative, overflow hidden, width/height from props via inline style), `lk-canvas-stack__overlay` (absolute, top/left/width/height 100%, pointer-events none).

- [ ] **Step 3: Commit**

  ```bash
  git add src/canvas/CanvasStack.tsx src/canvas/CanvasStack.less
  git commit -m "5a: Add CanvasStack component"
  ```

---

### Task 5a-7: CanvasStack tests

**Files:**
- Create: `src/canvas/CanvasStack.test.tsx`

- [ ] **Step 1: Mock canvas context**

  Add `vi.stubGlobal('HTMLCanvasElement', ...)` or use `getContext` mock so `CanvasRenderingContext2D` methods don't throw in jsdom.

- [ ] **Step 2: Write tests**

  - Renders correct number of `<canvas>` elements (one per layer)
  - `view` prop change triggers re-render cycle (mock render fn called)
  - Invisible layer's render fn not called
  - `onViewChange` invoked after synthetic wheel event

- [ ] **Step 3: Run tests**

  `cd ~/src/labkit && npx vitest run src/canvas/CanvasStack.test.tsx`
  Expected: all pass.

- [ ] **Step 4: Commit**

  ```bash
  git add src/canvas/CanvasStack.test.tsx
  git commit -m "5a: Add CanvasStack tests"
  ```

---

### Task 5a-8: CanvasStack Storybook stories

**Files:**
- Create: `src/canvas/CanvasStack.stories.tsx`

- [ ] **Step 1: Write stories**

  - `Default` — single layer, pan/zoom demo (renders a colored rect that follows world coords)
  - `MultiLayer` — three layers with different colors; toggle visibility via `LayerList` mock
  - `WithScaleIndicator` — `<ScaleIndicator>` as a `children` overlay (validates context pickup; will update after Task 5e)

- [ ] **Step 2: Smoke-test in Storybook**

  `npm run storybook` → open :6006 → verify Default story renders and pan/zoom works.

- [ ] **Step 3: Commit**

  ```bash
  git add src/canvas/CanvasStack.stories.tsx
  git commit -m "5a: Add CanvasStack Storybook stories"
  ```

---

### Task 5a-9: Capability types and Workspace runtime — canvas wiring

**Files:**
- Create: `src/instrument/capabilities.ts` (authoritative type definitions)
- Update: `src/instrument/index.ts` — re-export capability types
- Update: `src/workspace/WorkspaceRuntime.tsx` (Plan 3 file) — detect `canvas` capability, mount `<CanvasStack>`

- [ ] **Step 1: Write `src/instrument/capabilities.ts`**

  Define all capability interfaces exactly as in design spec §5 (and mirrored in spec §3.2, §4.2, §5.1, §6.1):
  - `ViewTransform`, `Point`, `HitResult`
  - `CanvasLayer<TS, TC>`, `CanvasCapability<TS, TC>`
  - `LayerDescriptor`, `LayerCapability<TS, TC>`
  - `PaletteItem`, `DragFeedback`, `DragDropCapability<TS, TC>`
  - `SystemEvent`
  - `UndoCapability<TS, TC>`

- [ ] **Step 2: Update `WorkspaceRuntime.tsx`**

  When `instrument.canvas` is present:
  - Adapt `CanvasLayer<TS, TC>` → `CanvasLayerDescriptor` (close over current state/config)
  - Render `<CanvasStack layers={...} view={workspaceView} onViewChange={setView} />`
  - Pass `instrument.canvas.hitTest` to `onHitTest` (world coords → HitResult, stored in ref for DragDrop)

- [ ] **Step 3: TypeScript check**

  `cd ~/src/labkit && npx tsc -b`
  Expected: 0 errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/instrument/capabilities.ts src/instrument/index.ts src/workspace/WorkspaceRuntime.tsx
  git commit -m "5a: Define capability types; wire canvas capability into Workspace runtime"
  ```

---

### Task 5a-10: Capability detector

**Files:**
- Create: `src/instrument/capabilityDetector.ts`
- Create: `src/instrument/capabilityDetector.test.ts`

- [ ] **Step 1: Write `capabilityDetector.ts`**

  ```ts
  export interface CapabilityFlags {
    hasCanvas: boolean;
    hasLayers: boolean;
    hasDragDrop: boolean;
    hasUndo: boolean;
  }

  export function detectCapabilities(instrument: Instrument<unknown, unknown>): CapabilityFlags;
  ```

  Pure function — no side effects.

- [ ] **Step 2: Write `capabilityDetector.test.ts`**

  Test all 16 combinations of present/absent capabilities. Assert correct flags.

- [ ] **Step 3: Run tests**

  `cd ~/src/labkit && npx vitest run src/instrument/capabilityDetector.test.ts`
  Expected: all pass.

- [ ] **Step 4: Commit**

  ```bash
  git add src/instrument/capabilityDetector.ts src/instrument/capabilityDetector.test.ts
  git commit -m "5a: Add capability detector (pure function, full test coverage)"
  ```

---

### Task 5a-11: canvas/index.ts and package exports

**Files:**
- Create: `src/canvas/index.ts`
- Update: `package.json` — add `"./canvas"` export entry
- Update: `tsup.config.ts` — add `canvas` entry point

- [ ] **Step 1: Write `src/canvas/index.ts`**

  Export: `CanvasStack`, `CanvasStackContext`, `CanvasStackContextValue`, and all types from `capabilities.ts` that belong to canvas.

- [ ] **Step 2: Update package.json exports**

  Add:
  ```json
  "./canvas": {
    "types": "./dist/canvas/index.d.ts",
    "import": "./dist/canvas/index.js"
  }
  ```

- [ ] **Step 3: Update tsup.config.ts**

  Add `src/canvas/index.ts` as an entry.

- [ ] **Step 4: Build check**

  `cd ~/src/labkit && npm run build`
  Expected: `dist/canvas/index.js` and `dist/canvas/index.d.ts` emitted.

- [ ] **Step 5: Commit**

  ```bash
  git add src/canvas/index.ts package.json tsup.config.ts
  git commit -m "5a: Export canvas entry point (@labkit/react/canvas)"
  ```

---

## Section 5b: Layers Capability

### Task 5b-1: LayerList component

**Files:**
- Create: `src/layers/LayerList.tsx`
- Create: `src/layers/LayerList.less`

Public API (see spec §4.1):

```tsx
interface LayerListProps {
  layers: LayerDescriptor[];
  onReorder: (newOrder: LayerDescriptor[]) => void;
  onToggle: (id: string, visible: boolean) => void;
  className?: string;
}
```

Implementation:
- `div.lk-layer-list` wrapper
- One `div.lk-layer-list__row` per item
- Visibility checkbox (`input[type=checkbox].lk-layer-list__check`); hidden + lock icon for `alwaysOn`
- Drag handle icon (`span.lk-layer-list__handle`) — pointer events initiate reorder drag
- Label `span.lk-layer-list__label`
- Pointer-event drag-to-reorder (see spec §4.1): pointerdown on handle → track pointermove → live reorder preview → pointerup commits
- `alwaysOn` rows rendered at bottom, no handle

- [ ] **Step 1: Write `LayerList.tsx`**

- [ ] **Step 2: Write `LayerList.less`**

  Styles: row layout (flex, align-center), handle cursor, alwaysOn lock icon, dragging row opacity/highlight, checkbox sizing.

- [ ] **Step 3: Commit**

  ```bash
  git add src/layers/LayerList.tsx src/layers/LayerList.less
  git commit -m "5b: Add LayerList component with pointer-event drag-to-reorder"
  ```

---

### Task 5b-2: LayerList tests

**Files:**
- Create: `src/layers/LayerList.test.tsx`

- [ ] **Step 1: Write tests**

  - Renders correct row count
  - `alwaysOn` row: no checkbox, lock icon present
  - `onToggle` called with correct id/visible on checkbox click
  - `onReorder` called after simulated pointerdown + pointermove (into next slot) + pointerup sequence

- [ ] **Step 2: Run tests**

  `cd ~/src/labkit && npx vitest run src/layers/LayerList.test.tsx`
  Expected: all pass.

- [ ] **Step 3: Commit**

  ```bash
  git add src/layers/LayerList.test.tsx
  git commit -m "5b: Add LayerList tests"
  ```

---

### Task 5b-3: LayerList Storybook stories

**Files:**
- Create: `src/layers/LayerList.stories.tsx`

- [ ] **Step 1: Write stories**

  - `Default` — 4 layers, all visible, all reorderable
  - `WithAlwaysOn` — mix of reorderable and `alwaysOn` layers
  - `Empty` — zero layers (renders empty state message)

- [ ] **Step 2: Verify in Storybook**

  `npm run storybook` → verify drag-to-reorder works in Default story.

- [ ] **Step 3: Commit**

  ```bash
  git add src/layers/LayerList.stories.tsx
  git commit -m "5b: Add LayerList Storybook stories"
  ```

---

### Task 5b-4: Layers capability wiring in Workspace runtime

**Files:**
- Update: `src/workspace/WorkspaceRuntime.tsx`

- [ ] **Step 1: Add layer visibility state to WorkspaceRecord**

  In Plan 2's store shape (`WorkspaceRecord`), add:
  ```ts
  layerVisibility: Record<string, boolean>;  // keyed by layer id; true = visible
  ```

  Initialize in `initialState`: all layers visible.

  **Note:** If Plan 2 is frozen and `WorkspaceRecord` cannot be edited, store `layerVisibility` in a local `useRef` within the Workspace component — acceptable at v0.

- [ ] **Step 2: Wire `layers` capability**

  When `instrument.layers` is present:
  - If `source === 'canvas'` (or undefined + canvas present): derive `LayerDescriptor[]` from `instrument.canvas.layers` + `layerVisibility` state
  - If `source` is a function: call `source(state, config)` each render
  - Render `<LayerList>` in Workspace sidebar
  - `onToggle` → update `layerVisibility` → emit `layers.toggle`
  - `onReorder` → update layer order in store → emit `layers.reorder`

- [ ] **Step 3: TypeScript check**

  `npx tsc -b`
  Expected: 0 errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/workspace/WorkspaceRuntime.tsx
  git commit -m "5b: Wire layers capability into Workspace runtime; emit layers.reorder and layers.toggle"
  ```

---

### Task 5b-5: layers/index.ts and package exports

**Files:**
- Create: `src/layers/index.ts`
- Update: `package.json`, `tsup.config.ts`

- [ ] **Step 1: Write `src/layers/index.ts`**

  Export: `LayerList`, `LayerListProps`, `LayerDescriptor`.

- [ ] **Step 2: Update package.json and tsup.config.ts**

  Add `"./layers"` export entry (same pattern as `"./canvas"`).

- [ ] **Step 3: Build check**

  `npm run build` → verify `dist/layers/` emitted.

- [ ] **Step 4: Commit**

  ```bash
  git add src/layers/index.ts package.json tsup.config.ts
  git commit -m "5b: Export layers entry point (@labkit/react/layers)"
  ```

---

## Section 5c: DragDrop Capability

### Task 5c-1: Palette component

**Files:**
- Create: `src/dragdrop/Palette.tsx`
- Create: `src/dragdrop/Palette.less`

Internal component (not a public export):

```tsx
interface PaletteProps {
  items: PaletteItem[];
  onDragStart: (item: PaletteItem, originScreenPos: Point) => void;
}
```

- `div.lk-palette` wrapper
- One `div.lk-palette__item` per item: icon (if present) + label
- `pointerdown` on item calls `onDragStart(item, pos)`; this is how the DragDropRuntime initiates a drag

- [ ] **Step 1: Write `Palette.tsx`**

- [ ] **Step 2: Write `Palette.less`**

  2-column grid, item min-height, hover highlight, cursor grab.

- [ ] **Step 3: Commit**

  ```bash
  git add src/dragdrop/Palette.tsx src/dragdrop/Palette.less
  git commit -m "5c: Add Palette component (internal)"
  ```

---

### Task 5c-2: DragGhost component

**Files:**
- Create: `src/dragdrop/DragGhost.tsx`
- Create: `src/dragdrop/DragGhost.less`

Internal component — renders the floating ghost image during an active drag:

```tsx
interface DragGhostProps {
  item: PaletteItem;
  screenPos: Point;   // cursor position; ghost follows this
}
```

- `div.lk-drag-ghost` rendered in a portal (`document.body`) at `position: fixed`; `pointer-events: none`
- Shows item icon and label
- Offset slightly from cursor (so the cursor tip is visible)

- [ ] **Step 1: Write `DragGhost.tsx` and `DragGhost.less`**

- [ ] **Step 2: Commit**

  ```bash
  git add src/dragdrop/DragGhost.tsx src/dragdrop/DragGhost.less
  git commit -m "5c: Add DragGhost portal component"
  ```

---

### Task 5c-3: DragDropRuntime

**Files:**
- Create: `src/dragdrop/DragDropRuntime.tsx`

Internal Workspace-layer component that manages the full drag pipeline. This is not a public primitive — it is mounted by `WorkspaceRuntime` when `dragDrop` capability is present.

Responsibilities:
- Holds active drag state: `{ item: PaletteItem; screenPos: Point } | null`
- Mounts `<DragGhost>` during active drag
- Listens to `pointermove` and `pointerup` on `window` during drag
- On `pointermove` over `<CanvasStack>` area: compute world pos, call `onDragOver` (rAF-throttled), manage feedback overlay layer
- On `pointerup` over canvas: call `onDrop` → update state → emit `canvas.itemAdded`
- On `pointerup` outside canvas: cancel drag
- Receives `lastHitResult` ref (set by `CanvasStack.onHitTest`) for `pickUp` initiation
- On `pointerdown` on canvas (when `pickUp` defined): check hit result → call `pickUp` → if non-null, start drag with returned item, update state, emit `canvas.itemRemoved`

**Feedback overlay:** When `onDragOver` returns `DragFeedback`, pass a feedback-layer `CanvasLayerDescriptor` as the topmost layer to `<CanvasStack>`. The layer renders a colored highlight circle/rect based on `feedback.valid`. When drag ends, pass `null` to remove the feedback layer.

- [ ] **Step 1: Write `DragDropRuntime.tsx`**

- [ ] **Step 2: TypeScript check**

  `npx tsc -b`
  Expected: 0 errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/dragdrop/DragDropRuntime.tsx
  git commit -m "5c: Add DragDropRuntime (internal orchestrator for drag pipeline)"
  ```

---

### Task 5c-4: Wire DragDrop into Workspace runtime

**Files:**
- Update: `src/workspace/WorkspaceRuntime.tsx`

- [ ] **Step 1: Mount DragDropRuntime when `hasDragDrop`**

  - Pass `instrument.dragDrop`, current `state`, `config`, `setState`, and the `emit` function
  - Pass `<Palette>` section into sidebar slot above `<LayerList>`
  - When `palette` is a function, call it with current `state`

- [ ] **Step 2: TypeScript check**

  `npx tsc -b`

- [ ] **Step 3: Commit**

  ```bash
  git add src/workspace/WorkspaceRuntime.tsx
  git commit -m "5c: Wire dragDrop capability into Workspace runtime"
  ```

---

### Task 5c-5: DragDrop integration test

**Files:**
- Create: `src/dragdrop/dragDrop.test.tsx`

This test renders a minimal `<Lab>` with a simple test instrument that has `canvas` + `dragDrop` capabilities.

- [ ] **Step 1: Write test instrument**

  In the test file, define a minimal inline instrument:
  ```ts
  const testInstrument = defineInstrument<{ items: string[] }, {}>({
    name: 'TestDrop',
    configSchema: () => [],
    defaultConfig: () => ({}),
    initialState: () => ({ items: [] }),
    canvas: {
      layers: [{ id: 'main', label: 'Main', render: () => {} }],
    },
    dragDrop: {
      palette: [{ id: 'a', label: 'Item A' }],
      onDrop: (pos, item, state) => ({ items: [...state.items, item.id] }),
    },
  });
  ```

- [ ] **Step 2: Write tests**

  - Palette item renders in sidebar
  - After simulated drag (pointerdown on palette → pointermove over canvas → pointerup over canvas): `state.items` contains the dropped item id
  - `canvas.itemAdded` event was emitted (spy on `ctx.emit` or instrument event listener)
  - Drag cancelled when pointerup outside canvas: state unchanged

- [ ] **Step 3: Run tests**

  `cd ~/src/labkit && npx vitest run src/dragdrop/dragDrop.test.tsx`
  Expected: all pass.

- [ ] **Step 4: Commit**

  ```bash
  git add src/dragdrop/dragDrop.test.tsx
  git commit -m "5c: Add DragDrop integration tests"
  ```

---

### Task 5c-6: dragdrop/index.ts (types export only)

**Files:**
- Create: `src/dragdrop/index.ts`

- [ ] **Step 1: Write `src/dragdrop/index.ts`**

  Export types only: `PaletteItem`, `DragFeedback`, `DragDropCapability`. No component exports (DragDropRuntime is internal).

- [ ] **Step 2: Update `src/instrument/index.ts`**

  Re-export `DragDropCapability` from capabilities.

- [ ] **Step 3: Commit**

  ```bash
  git add src/dragdrop/index.ts src/instrument/index.ts
  git commit -m "5c: Export DragDrop types from instrument/index"
  ```

---

## Section 5d: Undo Capability

### Task 5d-1: UndoStack data structure

**Files:**
- Create: `src/undo/undoStack.ts`
- Create: `src/undo/undoStack.test.ts`

- [ ] **Step 1: Write `undoStack.ts`**

  Define `UndoStack` interface and pure functions:
  - `emptyStack(): UndoStack`
  - `pushSnapshot(stack, snapshot, maxDepth): UndoStack`
    - FIFO eviction when `past.length === maxDepth`
    - Clears `future`
  - `undo(stack): { stack: UndoStack; snapshot: unknown } | null`
    - Returns null if `past` is empty
  - `redo(stack): { stack: UndoStack; snapshot: unknown } | null`
    - Returns null if `future` is empty
  - `clearUndo(stack): UndoStack`
    - Returns `{ past: [], future: [] }`

- [ ] **Step 2: Write `undoStack.test.ts`**

  Tests (all pure, no React):
  - `pushSnapshot` adds to past, clears future
  - `pushSnapshot` at maxDepth evicts `past[0]` (FIFO)
  - `undo` returns last pushed snapshot, moves it to future
  - `undo` on empty stack returns null
  - `redo` returns most-recently-undone snapshot, moves it back to past
  - `redo` on empty future returns null
  - Push → undo → push → redo returns null (redo invalidated by new push)
  - `clearUndo` zeros both arrays

- [ ] **Step 3: Run tests**

  `cd ~/src/labkit && npx vitest run src/undo/undoStack.test.ts`
  Expected: all pass.

- [ ] **Step 4: Commit**

  ```bash
  git add src/undo/undoStack.ts src/undo/undoStack.test.ts
  git commit -m "5d: Add UndoStack pure data structure with full test coverage"
  ```

---

### Task 5d-2: Event bus

**Files:**
- Create: `src/undo/eventBus.ts`
- Create: `src/undo/eventBus.test.ts`

The event bus is a lightweight synchronous pub/sub. It is instantiated per `<Lab>` (one instance in the Plan 2 Zustand store or as a store action).

- [ ] **Step 1: Write `eventBus.ts`**

  ```ts
  type EventListener = () => void;

  interface EventBus {
    on(event: string, listener: EventListener): () => void;  // returns unsubscribe fn
    emit(event: string): void;
    clear(): void;
  }

  function createEventBus(): EventBus;
  ```

  Pure factory function. Listeners stored in a `Map<string, Set<EventListener>>`.

- [ ] **Step 2: Write `eventBus.test.ts`**

  Tests:
  - Registered listener fires on matching `emit`
  - Registered listener does not fire on different event name
  - Unsubscribe function removes listener; does not fire after unsubscribe
  - Multiple listeners for same event all fire
  - `clear()` removes all listeners

- [ ] **Step 3: Run tests**

  `cd ~/src/labkit && npx vitest run src/undo/eventBus.test.ts`
  Expected: all pass.

- [ ] **Step 4: Commit**

  ```bash
  git add src/undo/eventBus.ts src/undo/eventBus.test.ts
  git commit -m "5d: Add synchronous event bus with tests"
  ```

---

### Task 5d-3: Wire event bus into Workspace runtime and RenderContext

**Files:**
- Update: `src/workspace/WorkspaceRuntime.tsx`
- Update: `src/instrument/RenderContext.ts` (or wherever Plan 3 defines `RenderContext`)

- [ ] **Step 1: Create event bus instance**

  The event bus is created once per Workspace (or per Lab). **CLAUDE'S DEFAULT:** One bus per Workspace, held in a `useRef` inside `WorkspaceRuntime`. This isolates event scopes between Workspaces.

- [ ] **Step 2: Expose `ctx.emit` on RenderContext**

  ```ts
  emit: (event: string) => void;  // calls eventBus.emit(event)
  ```

- [ ] **Step 3: Wire system events**

  The Workspace runtime calls `eventBus.emit(event)` at each of these points:
  - After every `setState` call → emit `'state.change'`
  - After every `setConfig(key, value)` call → emit `'config.change'` and `'config.change:' + key`
  - After `onReorder` → emit `'layers.reorder'`
  - After `onToggle` → emit `'layers.toggle'`
  - After `onDrop` → emit `'canvas.itemAdded'`
  - After `pickUp` → emit `'canvas.itemRemoved'`

- [ ] **Step 4: TypeScript check**

  `npx tsc -b`
  Expected: 0 errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/workspace/WorkspaceRuntime.tsx
  git commit -m "5d: Wire event bus into Workspace runtime; expose ctx.emit on RenderContext"
  ```

---

### Task 5d-4: Undo capability wiring

**Files:**
- Update: `src/workspace/WorkspaceRuntime.tsx`
- Update: `src/workspace/WorkspaceStore.ts` (Plan 2 file) — add `undoStack: UndoStack` to `WorkspaceRecord`

- [ ] **Step 1: Add `undoStack` to WorkspaceRecord**

  ```ts
  undoStack: UndoStack;  // session-only; not persisted
  ```

  Initialize with `emptyStack()`.

- [ ] **Step 2: Wire undo capability**

  When `instrument.undo` is present:
  - For each event in `undo.snapshotOn`, register a listener on the event bus
  - Listener: call `snapshot(state, config)` (default: `structuredClone(state)`) → `pushSnapshot(undoStack, snap, maxDepth)` → update stack in store
  - Unregister listeners on unmount or instrument switch

- [ ] **Step 3: Wire undo/redo toolbar buttons**

  The Plan 3 toolbar's Undo and Redo buttons become active:
  - Undo button: disabled when `undoStack.past.length === 0`; on click: call `undo(stack)` → `restore(snap, current)` (default: set `state = snap`, leave `config`) → update store
  - Redo button: disabled when `undoStack.future.length === 0`; on click: call `redo(stack)` → `restore(snap, current)` → update store

- [ ] **Step 4: TypeScript check**

  `npx tsc -b`
  Expected: 0 errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/workspace/WorkspaceRuntime.tsx src/workspace/WorkspaceStore.ts
  git commit -m "5d: Wire undo capability; activate undo/redo toolbar buttons"
  ```

---

### Task 5d-5: Undo integration test

**Files:**
- Create: `src/undo/undo.integration.test.tsx`

Renders a minimal `<Lab>` with a test instrument that has `canvas` + `dragDrop` + `undo` capabilities.

- [ ] **Step 1: Write test**

  - After a drop: state updated, snapshot in `undoStack.past`
  - After Undo button click: state reverts to pre-drop state, snapshot moves to `undoStack.future`
  - After Redo button click: state re-applies drop, snapshot returns to `undoStack.past`
  - Undo button disabled on initial render (empty stack)
  - After `maxDepth` drops, oldest snapshot evicted (stack stays at maxDepth)

- [ ] **Step 2: Run tests**

  `cd ~/src/labkit && npx vitest run src/undo/undo.integration.test.tsx`
  Expected: all pass.

- [ ] **Step 3: Commit**

  ```bash
  git add src/undo/undo.integration.test.tsx
  git commit -m "5d: Add undo integration tests (drop → undo → redo round-trip)"
  ```

---

### Task 5d-6: undo/index.ts

**Files:**
- Create: `src/undo/index.ts`

- [ ] **Step 1: Write `src/undo/index.ts`**

  Export: `UndoStack`, `UndoCapability`, `emptyStack`, `pushSnapshot`, `undo`, `redo`, `clearUndo`.

- [ ] **Step 2: Update `src/instrument/index.ts`**

  Re-export `UndoCapability` from capabilities.

- [ ] **Step 3: Update `@labkit/react/state` export**

  In `tsup.config.ts`, the `state` entry should include undo exports. Verify `@labkit/react/state` exports `UndoStack` and the pure functions.

- [ ] **Step 4: Commit**

  ```bash
  git add src/undo/index.ts src/instrument/index.ts tsup.config.ts
  git commit -m "5d: Export undo types and helpers from @labkit/react/state"
  ```

---

## Section 5e: ScaleIndicator Integration

### Task 5e-1: Update ScaleIndicator to read CanvasStackContext

**Files:**
- Update: `src/primitives/ScaleIndicator.tsx`
- Update: `src/primitives/ScaleIndicator.test.tsx`

- [ ] **Step 1: Update `ScaleIndicator.tsx`**

  Import `CanvasStackContext` from `src/canvas/CanvasStackContext`.
  
  Add `useContext(CanvasStackContext)` call. Update effective zoom resolution:
  ```ts
  const ctxValue = useContext(CanvasStackContext);
  const effectiveZoom = props.zoom ?? ctxValue?.view.zoom ?? 1.0;
  ```

  All other logic unchanged. Backwards compatible: explicit `zoom` prop still wins.

- [ ] **Step 2: Update `ScaleIndicator.test.tsx`**

  Add two new test cases:
  - When wrapped in a mock `CanvasStackContext.Provider` with `view.zoom = 2.5` and no `zoom` prop: indicator reflects `2.5`
  - When `zoom` prop is supplied explicitly alongside context: explicit prop wins

- [ ] **Step 3: Run tests**

  `cd ~/src/labkit && npx vitest run src/primitives/ScaleIndicator.test.tsx`
  Expected: all pass, including pre-existing Plan 1 tests.

- [ ] **Step 4: Commit**

  ```bash
  git add src/primitives/ScaleIndicator.tsx src/primitives/ScaleIndicator.test.tsx
  git commit -m "5e: ScaleIndicator reads zoom from CanvasStackContext when no explicit prop"
  ```

---

### Task 5e-2: Update CanvasStack WithScaleIndicator story

**Files:**
- Update: `src/canvas/CanvasStack.stories.tsx`

- [ ] **Step 1: Update the `WithScaleIndicator` story**

  Now that context lookup is implemented, verify the `WithScaleIndicator` story (added in Task 5a-8) correctly shows the zoom level updating as the user pans/zooms.

- [ ] **Step 2: Smoke-test in Storybook**

  `npm run storybook` → open WithScaleIndicator story → pan/zoom → confirm scale indicator updates.

- [ ] **Step 3: Commit**

  ```bash
  git add src/canvas/CanvasStack.stories.tsx
  git commit -m "5e: Verify ScaleIndicator+CanvasStack story works with context integration"
  ```

---

## Section 5f: Integration, Smoke Tests, and Final Wiring

### Task 5f-1: drag-lab example

**Files:**
- Create: `examples/drag-lab/main.tsx` (and supporting files)

Port the `garden-planner/src/drag-lab` example as a standalone Vite example. This is the primary proving ground for all capabilities working together.

**Implementer research task:** Read `~/src/eric/src/drag-lab/` to understand the example structure. Port it using `defineInstrument` with `canvas` + `layers` + `dragDrop` + `undo` capabilities. Do not copy files verbatim.

- [ ] **Step 1: Read garden-planner drag-lab source**

  Read `~/src/eric/src/drag-lab/` (implementer task). Understand the instrument shape, palette items, drop behavior, and layer setup.

- [ ] **Step 2: Write `examples/drag-lab/main.tsx`**

  Minimal working drag-lab using labkit:
  - `defineInstrument` with canvas + layers (source: 'canvas') + dragDrop + undo
  - 2–3 palette items
  - Renders in a single `<Lab>` with one `<Workspace>`

- [ ] **Step 3: Verify example runs**

  `cd ~/src/labkit && npm run dev` → open browser → drag items from palette onto canvas → toggle layers → undo/redo.

- [ ] **Step 4: Commit**

  ```bash
  git add examples/drag-lab/
  git commit -m "5f: Add drag-lab example (canvas + layers + dragDrop + undo proving ground)"
  ```

---

### Task 5f-2: Full test suite run

**Files:** (none)

- [ ] **Step 1: Run full test suite**

  `cd ~/src/labkit && npm test`
  Expected: all tests pass; coverage ≥ 70% on `src/`.

- [ ] **Step 2: Run TypeScript check**

  `npx tsc -b`
  Expected: 0 errors.

- [ ] **Step 3: Run lint**

  `npm run lint`
  Expected: 0 errors (including class-prefix check).

- [ ] **Step 4: Commit any fixes**

  Fix and commit any issues found. Message: `5f: Fix test/lint issues from full suite run`.

---

### Task 5f-3: AGENTS.md updates

**Files:**
- Update: `docs/AGENTS.md`
- Create: `src/canvas/AGENTS.md`
- Create: `src/layers/AGENTS.md`

- [ ] **Step 1: Update root `docs/AGENTS.md`**

  Add entries for:
  - `CanvasStack` → `src/canvas/CanvasStack.tsx`
  - `LayerList` → `src/layers/LayerList.tsx`
  - `UndoStack` → `src/undo/undoStack.ts`
  - Capability types → `src/instrument/capabilities.ts`
  - DragDrop pipeline → `src/dragdrop/DragDropRuntime.tsx`

- [ ] **Step 2: Write `src/canvas/AGENTS.md`**

  Props, extension points, "what to read if you want to add a new layer type."

- [ ] **Step 3: Write `src/layers/AGENTS.md`**

  Props, drag handle customization, `alwaysOn` semantics.

- [ ] **Step 4: Commit**

  ```bash
  git add docs/AGENTS.md src/canvas/AGENTS.md src/layers/AGENTS.md
  git commit -m "5f: Update AGENTS.md with canvas/layers/undo/dragDrop source map"
  ```

---

### Task 5f-4: RECIPES.md additions

**Files:**
- Update: `docs/RECIPES.md`

- [ ] **Step 1: Add capability recipes**

  Add recipes (see design spec §10):
  - "Build a drag-and-drop layout lab (drag-lab equivalent)"
  - "Build a layered visualization lab (canvas + layer toggles)"
  - "Add a custom undoable action via `ctx.emit(...)`"

- [ ] **Step 2: Commit**

  ```bash
  git add docs/RECIPES.md
  git commit -m "5f: Add capability recipes to RECIPES.md"
  ```

---

### Task 5f-5: Final smoke test and release-check

**Files:** (none)

- [ ] **Step 1: Build the library**

  `cd ~/src/labkit && npm run build`
  Expected: `dist/` emitted with all entry points: `index.js`, `canvas/index.js`, `layers/index.js`, `primitives/index.js`, `state/index.js` plus CSS files.

- [ ] **Step 2: Smoke-test the build output**

  In `examples/drag-lab/main.tsx`, temporarily change import to `@labkit/react/canvas` (using the built dist, not source). Verify Vite resolves it correctly.

  Revert the import change before committing.

- [ ] **Step 3: Storybook build**

  `npm run build-storybook`
  Expected: `storybook-static/` created with no errors.

- [ ] **Step 4: Verify package exports**

  `node -e "import('@labkit/react/canvas').then(m => console.log(Object.keys(m)))"`  
  Expected: prints `['CanvasStack', 'CanvasStackContext', ...]`.

- [ ] **Step 5: Final commit**

  ```bash
  git add -A  # verify nothing sensitive staged
  git commit -m "5f: v0.1 capabilities subsystem complete — canvas, layers, dragDrop, undo"
  ```

---

## Summary

| Section | Tasks | Description |
|---|---|---|
| 5a | 5a-1 → 5a-11 | CanvasStack primitive, types, Workspace wiring |
| 5b | 5b-1 → 5b-5 | LayerList primitive, layers capability wiring |
| 5c | 5c-1 → 5c-6 | Palette, DragGhost, DragDropRuntime, integration test |
| 5d | 5d-1 → 5d-6 | UndoStack, event bus, Workspace wiring, integration test |
| 5e | 5e-1 → 5e-2 | ScaleIndicator context integration |
| 5f | 5f-1 → 5f-5 | drag-lab example, full test run, docs, smoke test |

**Total tasks: 37** (each 5–15 min for a focused subagent)
