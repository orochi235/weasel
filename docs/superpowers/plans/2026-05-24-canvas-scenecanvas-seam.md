# Canvas / SceneCanvas Seam Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redraw the responsibility line between `<Canvas>` and `<SceneCanvas>`. After this plan, `<Canvas>` is a coherent scene-agnostic primitive (WebGL surface + viewport + pointer routing + slot composition) and `<SceneCanvas>` owns all scene-shaped concerns (selection, picking, kind registry, tools/actions, scene-aware overlays). `<Canvas>` remains `@internal` / `@deprecated` in public docs; re-promotion is a separate decision deferred to a follow-up.

**Architecture:** Six phases, each independently green, each ending in a commit. Phase 0 builds a safety net. Phases 1-2 move scene-agnostic concerns (viewport tools, HUDs, background fill) so they're available on `<Canvas>` instead of being constructed by `<SceneCanvas>`. Phases 3-4 lift scene-shaped concerns (selection, picking) out of `<Canvas>` entirely. Phase 5 audits and tightens `<Canvas>`'s prop surface to match its new identity. Phase 6 updates JSDoc and the TODO.

**Tech Stack:** TypeScript, React 19, Vitest, Playwright (visual regression). No new dependencies.

**Why:** The current seam is drawn around *"who supplies the adapter"* but the actual cleavage is *"surface + viewport"* vs *"scene + selection + tools"*. The result is `<Canvas>` owning a built-in `useSelection`, a `pickEvery`/`adapter.kindOf` synthesizer, and selection-overlay layer factories — all scene-shaped concerns that don't belong in a "low-level WebGL surface + pointer router." Meanwhile `<SceneCanvas>` owns viewport pan/zoom, background fill, and cursor/pick HUDs — all scene-agnostic concerns that should sit at the surface layer. This refactor moves each misplaced bit to its correct side. `<Canvas>` stays `@internal`; the re-promotion question is intentionally deferred.

---

## File Structure

**Files modified (primary):**
- `src/canvas/Canvas.tsx` — gains `viewport?`, `backgroundFill?`, `cursorCoordsHud?`, `pickHud?`, `getNodeAtPoint?` props; loses internal `useSelection` fallback, `pickEvery`/`kindOf` synthesizer
- `src/canvas/SceneCanvas.tsx` — stops constructing viewport tools, background-fill layer, HUDs locally; forwards new props down; always passes a `selection` and `getNodeAtPoint` to `<Canvas>`

**Files modified (secondary):**
- `src/canvas/SceneCanvas.useSelectTool.tsx` (or wherever `useSceneSelectTool` lives) — the `getNodeAtPoint` builder needs a stable exported helper SceneCanvas can call
- `src/tools/dispatcher.ts` — the `adapter.kindOf` cast at `:29` can be deleted once the Canvas-side reader is gone; SceneCanvas already routes kind via its own classifier into adapter

**Files created:**
- `src/canvas/Canvas.viewport.test.tsx` — viewport-on-Canvas regression coverage
- `src/canvas/Canvas.huds.test.tsx` — HUDs-on-Canvas regression coverage
- `src/canvas/Canvas.no-selection.test.tsx` — Canvas works without a selection prop (renders, no chrome, no select-on-click)

**Files NOT touched in this plan (out of scope, separate work):**
- `src/canvas/sceneAdapter.ts` — `adapter.kindOf` field stays for now; deletion is the existing TODO "Remove `adapter.kindOf` escape hatch"
- Re-export of `<Canvas>` from `src/index.ts` — stays excluded; the re-promotion decision is deferred

**Files this plan deliberately does NOT split:**
- `src/canvas/Canvas.tsx` (1302 lines) and `src/canvas/SceneCanvas.tsx` (1383 lines) are both large enough to warrant splitting in principle, but a split during this refactor would entangle the diff and make Phase rollbacks unsafe. File splitting is a separate follow-up.

---

## Phase 0: Safety Net

Establish the test baselines this refactor relies on. Skip nothing here — Phase 3 (selection move) is the riskiest change and depends on these tests catching regressions.

### Task 0.1: Inventory existing Canvas/SceneCanvas test coverage

**Files:**
- Read: all `src/canvas/*.test.tsx`, all `src/canvas/*.integration.test.tsx`, all `src/canvas/*.smoke.test.tsx`

- [ ] **Step 1: List the existing tests**

Run: `ls src/canvas/*.test.tsx src/canvas/*.smoke.test.tsx src/canvas/*.integration.test.tsx 2>&1`

Capture the list. Open each file and write a one-line note: what does it cover?

- [ ] **Step 2: Identify gaps**

Compare the coverage list against this list of behaviors that MUST stay green through the refactor:

1. Outside-click clears selection (Canvas's pointer backstop). Should be covered by an existing Canvas selection integration test.
2. `selectionMode='multi'` allows multi-select via pickEvery walk.
3. `pickEvery` respects current view (zoom/pan applied to incoming worldXY).
4. `view`/`onViewChange` controlled and uncontrolled paths both work.
5. `tools.dispatcher` receives pointer events with worldXY transformed by current view.
6. Layer composition order: backgroundFill < scene < tool overlays < debug.
7. SceneCanvas's `backgroundFill` prop reaches the canvas pixels.
8. SceneCanvas's `cursorCoordsHud` / `pickHud` render and update on pointer move.
9. SceneCanvas's `viewport.pan` / `viewport.zoom` register the hand tool and zoom descriptor.

For each that is NOT covered by an existing test: add a covering test as a separate sub-task before Phase 1 begins.

- [ ] **Step 3: Run the existing suite to confirm baseline green**

Run: `npm run typecheck && npm run test`

Expected: PASS. Note any flakes — they need quarantine before this refactor or they'll be confounded with refactor regressions.

- [ ] **Step 4: Run visual regression baseline**

Run: `npm run test:visual` (locally; will produce a baseline-vs-current diff)

Expected: any pre-existing diffs are noted. The refactor MUST NOT introduce new visual diffs in any of the existing baselines (`tests/visual/baselines/*.png`).

- [ ] **Step 5: Commit any added coverage**

```bash
git add src/canvas/*.test.tsx
git commit -m "test(canvas): cover behaviors load-bearing for the seam refactor"
```

If no tests were added, skip the commit and proceed.

---

## Phase 1: Move viewport tools to Canvas

Today: `<SceneCanvas>` calls `useViewportTools({ viewport })` (`SceneCanvas.tsx:740`), registers the hand tool, and sets up viewport.pan / viewport.zoom action descriptors. `<Canvas>` already owns view state but knows nothing about pan/zoom tools.

Goal: `<Canvas>` accepts a `viewport?: { pan?, zoom? }` prop with identical semantics; it mounts the viewport tools itself. `<SceneCanvas>` forwards its `viewport` prop down and stops calling `useViewportTools` locally.

### Task 1.1: Add `viewport` prop to `<Canvas>`, mount viewport tools internally

**Files:**
- Modify: `src/canvas/Canvas.tsx:148-274` (props interface), `:480-520` (prop destructure), `:660-690` (tools wiring)
- Modify: `src/canvas/SceneCanvas.tsx:467-470` (viewport prop type — keep same shape), `:740` (delete `useViewportTools` call), `:805-815` (remove `viewportAmbient`/`handTool` wiring), `:1017-1020` (add `viewport={viewport}` to forwarded props)

- [ ] **Step 1: Add the failing test**

Create `src/canvas/Canvas.viewport.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Canvas } from './Canvas';

describe('<Canvas> viewport prop', () => {
  it('mounts the hand tool when viewport.pan is enabled', () => {
    // Render Canvas with viewport={{ pan: true }} and assert
    // tools.registry contains 'hand'. The hand tool surfaces via
    // tools.list() — assert it.
    // (Exact assertion shape depends on how tools are exposed; see
    // useViewportTools test for the current pattern.)
    expect.fail('write the assertion');
  });

  it('registers viewport.pan and viewport.zoom action descriptors when enabled', () => {
    // Render Canvas with viewport={{ pan: true, zoom: true }} and
    // assert the dep registry contains 'viewport.pan' and
    // 'viewport.zoom' action descriptors.
    expect.fail('write the assertion');
  });

  it('omits viewport tools when viewport prop is absent', () => {
    // Render Canvas with no viewport prop; assert no hand tool,
    // no viewport.pan / viewport.zoom descriptors.
    expect.fail('write the assertion');
  });
});
```

- [ ] **Step 2: Run the failing test**

Run: `npx vitest run src/canvas/Canvas.viewport.test.tsx`
Expected: FAIL (test bodies are `expect.fail`).

- [ ] **Step 3: Flesh the tests against the current `<SceneCanvas>`'s viewport behavior**

Read `src/canvas/SceneCanvas.tsx:740-820` to learn the exact shapes (which dep keys, which tool registry keys, the `viewportRegistered` flag). Mirror them in the test assertions.

Re-run, expected: FAIL with the real assertions (because `<Canvas>` doesn't accept `viewport` yet).

- [ ] **Step 4: Add `viewport` to `CanvasProps`**

In `src/canvas/Canvas.tsx`, copy the `viewport?: { pan?, zoom? }` prop type from `SceneCanvas.tsx:467-470` verbatim (keep the same JSDoc — it documents real behavior).

- [ ] **Step 5: Lift `useViewportTools` call from SceneCanvas into Canvas**

In `src/canvas/Canvas.tsx`, near the existing tools-wiring block, add:

```ts
import { useViewportTools } from '...';  // copy import from SceneCanvas.tsx

// inside the component, after view state is established:
const { handTool, viewportRegistered } = useViewportTools({
  viewport,
  currentViewRef,
  // ... whatever args the SceneCanvas call site passes
});
```

Walk `SceneCanvas.tsx:740-815` and lift the entire wiring block: the `viewportAmbient` array, the `internalRegistry.hand = handTool` line, the descriptor registrations. Whatever the SceneCanvas block does, do it here.

Critical: if Canvas already accepts a `tools` prop (it does — `:196-198`), the viewport tools need to merge INTO the supplied tools, not replace them. Look at how SceneCanvas merges `mergedAmbient` (`:807`) and mirror that.

- [ ] **Step 6: Delete the SceneCanvas-side viewport wiring**

In `src/canvas/SceneCanvas.tsx`:
- Delete the `useViewportTools` call at `:740`.
- Delete `viewportAmbient`, `viewportRegistered` usages.
- Delete the `internalRegistry.hand = handTool` line.
- Delete viewport-related entries from `mergedAmbient`.
- Add `viewport={viewport}` to the `<Canvas>` forwarded props near `:1017`.
- Keep the `viewportPanEnabled` / `viewportZoomEnabled` flags passed to `StandardActionsRegistrar` (`:1052-1053`) — they're a SceneCanvas-level concern about which standard actions to register.

- [ ] **Step 7: Run the new test**

Run: `npx vitest run src/canvas/Canvas.viewport.test.tsx`
Expected: PASS.

- [ ] **Step 8: Run the full kit and draw suites**

Run: `npm run test:kit && npm run test:draw`
Expected: PASS. SceneCanvas's existing viewport tests should still pass because behavior is identical from the consumer's perspective — only the internal mounting site moved.

- [ ] **Step 9: Run the visual regression suite**

Run: `npm run test:visual`
Expected: no new diffs on `viewport.png`, `zoom.png`, `pan.png`, `parallax.png`, or any baseline involving view changes.

- [ ] **Step 10: Commit**

```bash
git add src/canvas/Canvas.tsx src/canvas/SceneCanvas.tsx src/canvas/Canvas.viewport.test.tsx
git commit -m "refactor(canvas): move viewport tools mount from SceneCanvas to Canvas"
```

---

## Phase 2: Move `backgroundFill` + HUDs to Canvas

Today: `<SceneCanvas>` constructs a `backgroundLayer` from `backgroundFill` and merges it into `wiredLayers` (`:933-965`); it renders `<CursorCoordsHud>` and `<PickHud>` siblings outside `<Canvas>` (`:1029-1039`).

Goal: `<Canvas>` accepts `backgroundFill?`, `cursorCoordsHud?`, `pickHud?` props directly. SceneCanvas forwards them.

### Task 2.1: Add `backgroundFill` to `<Canvas>`

**Files:**
- Modify: `src/canvas/Canvas.tsx` (props + layer composition)
- Modify: `src/canvas/SceneCanvas.tsx:548-549` (delete `backgroundFill?` from `SceneCanvasProps` only if it was actually a SceneCanvas-only prop — it isn't; keep the prop on SceneCanvas for back-compat, just forward it), `:933-965` (delete the local `backgroundLayer` construction)

- [ ] **Step 1: Write the failing test**

In `src/canvas/Canvas.huds.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from './Canvas';

describe('<Canvas> backgroundFill prop', () => {
  it('paints the canvas with the supplied fill before scene layers', () => {
    // Render Canvas with backgroundFill={{ kind: 'solid', color: '#ff0000' }}
    // and an empty scene. Read the canvas pixel buffer at (0,0) and
    // assert it's red (modulo headless-GL gotchas — copy a working
    // pixel-read helper from an existing Canvas test, or assert at the
    // layer-composition level via a spy on `renderer.paint`).
    expect.fail('write the assertion');
  });
});
```

- [ ] **Step 2: Run, expected FAIL**

Run: `npx vitest run src/canvas/Canvas.huds.test.tsx`

- [ ] **Step 3: Add `backgroundFill?: FillStyle` to `CanvasProps`**

Copy the prop type + JSDoc from `SceneCanvas.tsx:548`.

- [ ] **Step 4: Lift the `backgroundLayer` construction into Canvas**

Move `SceneCanvas.tsx:933-944` (the `backgroundLayer` `useMemo`) into Canvas. Merge it into the layer composition at the spot where `wiredLayers` is assembled — before the `scene` slot, after any user-provided `before: 'scene'` layers (mirror what SceneCanvas does at `:965`).

- [ ] **Step 5: Delete SceneCanvas-side construction**

In SceneCanvas: delete the `backgroundLayer` useMemo and the `wiredLayers` entry that injects it. Add `backgroundFill={backgroundFill}` to the `<Canvas>` forwarded props.

- [ ] **Step 6: Run, expected PASS**

Run: `npx vitest run src/canvas/Canvas.huds.test.tsx`

- [ ] **Step 7: Commit**

```bash
git add src/canvas/Canvas.tsx src/canvas/SceneCanvas.tsx src/canvas/Canvas.huds.test.tsx
git commit -m "refactor(canvas): move backgroundFill from SceneCanvas to Canvas"
```

### Task 2.2: Add `cursorCoordsHud` and `pickHud` to `<Canvas>`

**Files:**
- Modify: `src/canvas/Canvas.tsx` (props + render block — HUDs must render as siblings of the `<canvas>` inside Canvas's wrapper)
- Modify: `src/canvas/SceneCanvas.tsx:551-562` (delete props OR keep and forward), `:1029-1039` (delete local HUD render — but keep PointerPublisher; it's unrelated)

- [ ] **Step 1: Extend the test**

Append to `src/canvas/Canvas.huds.test.tsx`:

```tsx
describe('<Canvas> HUDs', () => {
  it('renders CursorCoordsHud when cursorCoordsHud is true', () => {
    // Render Canvas with cursorCoordsHud, fire a pointermove, assert
    // the HUD text reflects the world coords. Copy the pointer event
    // shape from an existing SceneCanvas HUD test if one exists.
    expect.fail('write the assertion');
  });

  it('renders PickHud when pickHud is true and pickEvery is provided', () => {
    // Mirror the above for PickHud. PickHud needs pickEvery to be
    // useful, so the test wires a fake pickEvery that returns a known
    // id at a known worldXY.
    expect.fail('write the assertion');
  });
});
```

- [ ] **Step 2: Run, expected FAIL**

- [ ] **Step 3: Add `cursorCoordsHud?: boolean` and `pickHud?: boolean` to `CanvasProps`**

- [ ] **Step 4: Render the HUDs inside Canvas**

In Canvas's render, after the `<canvas>` element, add (mirror SceneCanvas:1029-1039):

```tsx
{cursorCoordsHud && (
  <CursorCoordsHud canvasRef={internalCanvasRef} viewRef={currentViewRef} />
)}
{pickHud && (
  <PickHud
    canvasRef={internalCanvasRef}
    viewRef={currentViewRef}
    pickEvery={pickEveryRef.current}
    pickBest={pickBestRef.current /* see Phase 4 — for now, pass through what SceneCanvas had */}
  />
)}
```

The HUDs depend on `pickEvery` / `pickBest` callbacks. Phase 4 lifts picking out of Canvas entirely; until then, these HUDs read from Canvas's existing pickEvery. After Phase 4, the HUDs continue to work because the props plumb through.

- [ ] **Step 5: Delete SceneCanvas-side HUD render**

In SceneCanvas: delete the local `<CursorCoordsHud>` / `<PickHud>` siblings at `:1029-1039`. Add `cursorCoordsHud={cursorCoordsHud}` and `pickHud={pickHud}` to forwarded props on `<Canvas>`.

Note: `PointerPublisher` at `:1040` stays — it's a SceneCanvas-level concern (publishes pointer state to the ambient `PointerContext`).

- [ ] **Step 6: Run, expected PASS**

- [ ] **Step 7: Commit**

```bash
git add -p src/canvas/Canvas.tsx src/canvas/SceneCanvas.tsx src/canvas/Canvas.huds.test.tsx
git commit -m "refactor(canvas): move cursorCoordsHud and pickHud from SceneCanvas to Canvas"
```

---

## Phase 3: Move selection out of Canvas (riskiest phase)

Today: `<Canvas>` accepts an optional `selection` prop AND falls back to a built-in `useSelection` (`Canvas.tsx:599`). It also derives `selectionMode='none'` semantics by wrapping the selection (`:606-617`).

Goal: `<Canvas>` accepts only an optional `selection` prop. When absent, Canvas behaves as if `selectionMode='none'` — no selection chrome, no select-on-click backstop, no outside-click clear. `<SceneCanvas>` always passes a selection.

The outside-click backstop is the bear. Today Canvas installs a document-level pointer listener that clears selection on clicks outside the canvas (or that interact with the canvas in a non-tool-handled way). This listener needs a clear new home — either it moves to SceneCanvas (which owns the selection) or it becomes a callback prop on Canvas (`onBackgroundClick?: () => void`).

Recommendation: callback prop. Canvas stays selection-agnostic; SceneCanvas wires `onBackgroundClick={() => selection.clear()}`.

### Task 3.1: Audit Canvas's selection-touch sites

**Files:**
- Read: `src/canvas/Canvas.tsx` (every line that touches `selection`, `internalSelection`, `selectionMode`, `derivedSelectionOptions`, `baseSelection`)

- [ ] **Step 1: Grep all selection-touching sites**

Run: `grep -n "selection\|Selection" src/canvas/Canvas.tsx | grep -v "//\|@" | head -80`

Capture the list. For each site, write a one-line note: is this reading selection state, mutating it, or providing context?

- [ ] **Step 2: Categorize each site**

Three categories:
- A. **Provides selection to child slots** (selection-overlay, debug overlay, tool dispatcher) — these stay; they consume the prop.
- B. **Owns/derives selection state** (the `useSelection` call, the `selectionMode='none'` wrap, the `derivedSelectionOptions` build) — these move to SceneCanvas.
- C. **Installs document-level outside-click listener** — becomes an `onBackgroundClick?` callback prop.

Document the categorization in a comment block at the top of the next task's commit so reviewers can follow the move.

- [ ] **Step 3: Commit the audit notes** (optional)

If the audit produced inline TODO comments in Canvas.tsx marking each site, commit them now so the next task's diff is clean:

```bash
git add src/canvas/Canvas.tsx
git commit -m "chore(canvas): annotate selection touch sites pre-extraction"
```

### Task 3.2: Add `onBackgroundClick` to Canvas; remove the `useSelection` fallback

**Files:**
- Modify: `src/canvas/Canvas.tsx:599-617` (remove `internalSelection`, the `selectionMode='none'` wrap, the `derivedSelectionOptions` build, and the `useSelection` import if no longer used)
- Modify: `src/canvas/Canvas.tsx` (props: `selection` becomes optional but no internal fallback; `selectionMode` is removed; `onBackgroundClick?: () => void` is added)
- Modify: `src/canvas/SceneCanvas.tsx` (`selectionMode` prop stays on SceneCanvas; SceneCanvas derives the effective selection from its own `useSelection` and passes a non-null `selection` to Canvas; passes `onBackgroundClick={() => selection.clear()}`)

- [ ] **Step 1: Write the failing test**

Create `src/canvas/Canvas.no-selection.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Canvas } from './Canvas';

describe('<Canvas> without selection prop', () => {
  it('renders without throwing', () => {
    const { container } = render(<Canvas width={100} height={100} />);
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('does not register an outside-click listener when onBackgroundClick is absent', () => {
    const spy = vi.spyOn(document, 'addEventListener');
    render(<Canvas width={100} height={100} />);
    const pointerListeners = spy.mock.calls.filter(
      (c) => c[0] === 'pointerdown' || c[0] === 'pointerup' || c[0] === 'click'
    );
    // The exact assertion depends on what Canvas currently does even
    // without selection. Refine after reading the current code.
    expect(pointerListeners).toEqual([]);
  });

  it('fires onBackgroundClick when supplied and the canvas receives a non-tool-handled click', () => {
    const onBackgroundClick = vi.fn();
    const { container } = render(
      <Canvas width={100} height={100} onBackgroundClick={onBackgroundClick} />
    );
    const canvas = container.querySelector('canvas')!;
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.pointerUp(canvas, { clientX: 10, clientY: 10 });
    expect(onBackgroundClick).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, expected FAIL**

Run: `npx vitest run src/canvas/Canvas.no-selection.test.tsx`

- [ ] **Step 3: Remove `useSelection` from Canvas**

In `src/canvas/Canvas.tsx`:
- Delete `:599` (`internalSelection`).
- Delete `:606-617` (`baseSelection` / `selectionMode='none'` wrap).
- Delete `derivedSelectionOptions` build (`:593-597` or wherever it sits).
- Delete `selectionMode` from `CanvasProps`.
- Delete `selectionOptions` from `CanvasProps` (it only fed `useSelection`).
- Delete the `useSelection` import.
- The `selection` prop becomes the only source of selection state. Make it required at the type level OR allow `undefined` and treat absence as "no selection." Pick allow-undefined for back-compat with bare-Canvas non-scene consumers.

- [ ] **Step 4: Replace selection-clear logic with `onBackgroundClick` callback**

Find the existing outside-click handler. It probably looks like:

```ts
// somewhere in Canvas.tsx
const handleBackgroundClick = () => {
  selection?.clear();
};
```

Replace with:

```ts
const handleBackgroundClick = () => {
  onBackgroundClick?.();
};
```

Add `onBackgroundClick?: () => void` to `CanvasProps`. The listener should only install when `onBackgroundClick` is supplied (mirror the test's assertion).

- [ ] **Step 5: Update SceneCanvas to always pass a selection and an `onBackgroundClick`**

In `src/canvas/SceneCanvas.tsx`:
- Keep the `useSelection` call at `:676` (`internalSelection`).
- Keep the `selectionMode` prop — SceneCanvas owns the multi-vs-single decision.
- Pass `selection={selection}` to Canvas (already does this at `:988`; keep).
- Add `onBackgroundClick={() => selection.clear()}` to the Canvas props.
- Remove `selectionMode` from the props forwarded to Canvas (Canvas no longer accepts it).

- [ ] **Step 6: Migrate selection-overlay rendering**

Today Canvas's layer composition includes a `selection-overlay` slot wired to read from the internal selection. With selection now external, the overlay needs the supplied `selection` prop. Trace the `selectionOverlay` wiring; ensure it reads from the prop, not from an internal `useSelection`.

If the overlay layer factory was selection-aware in Canvas, move the factory to SceneCanvas (which knows about scene-shaped selection rendering) and have SceneCanvas pass it as a `layers.selectionOverlay` entry to Canvas. Canvas just renders the slot.

- [ ] **Step 7: Run the new test**

Run: `npx vitest run src/canvas/Canvas.no-selection.test.tsx`
Expected: PASS.

- [ ] **Step 8: Run the full canvas suite**

Run: `npx vitest run src/canvas/`
Expected: PASS. SceneCanvas tests must still pass because the public selection behavior is identical from the consumer's perspective.

- [ ] **Step 9: Run the visual regression suite**

Run: `npm run test:visual`
Expected: no new diffs on `multi-select.png`, `move.png`, `resize.png`, `rotate.png`, or any selection-chrome baseline.

- [ ] **Step 10: Commit**

```bash
git add src/canvas/Canvas.tsx src/canvas/SceneCanvas.tsx src/canvas/Canvas.no-selection.test.tsx
git commit -m "refactor(canvas): lift selection ownership from Canvas to SceneCanvas"
```

### Task 3.3: Move scene-aware layer factories to SceneCanvas

**Files:**
- Modify: `src/canvas/Canvas.tsx` (remove `selectionOverlay`, `cellHighlight` layer factories; keep `grid` — it's view-aware, not scene-aware)
- Modify: `src/canvas/SceneCanvas.tsx` (construct selectionOverlay and cellHighlight locally and pass via `layers.selectionOverlay` / `layers.cellHighlight`)

- [ ] **Step 1: Locate the factories**

Grep: `grep -n "selectionOverlay\|cellHighlight\|createSelectionOverlay\|createCellHighlight" src/canvas/Canvas.tsx`

- [ ] **Step 2: Move each factory**

For each factory currently in Canvas:
- If it's a pure function exported from somewhere else and Canvas just calls it: the import + call site moves to SceneCanvas.
- If it's inline in Canvas: extract to its current import-source (or co-locate with SceneCanvas) and move the call site.

The `grid` layer factory stays in Canvas — grid lines are a view-space concern (they respond to zoom/pan and have no scene awareness).

- [ ] **Step 3: Run the full canvas suite + visual regression**

Run: `npx vitest run src/canvas/ && npm run test:visual`
Expected: PASS, no new visual diffs.

- [ ] **Step 4: Commit**

```bash
git add src/canvas/Canvas.tsx src/canvas/SceneCanvas.tsx
git commit -m "refactor(canvas): move selection-overlay and cell-highlight factories to SceneCanvas"
```

---

## Phase 4: Move picking out of Canvas

Today: Canvas synthesizes a `getNodeAtPoint(worldXY)` from `pickEvery` + `adapter.kindOf` (`Canvas.tsx:697-732`) and installs it via the dispatcher's `__setGetNodeAtPoint`. SceneCanvas already computes its own `internalPickEvery` (`:728`) and passes it to Canvas (`:991`).

Goal: Canvas accepts a `getNodeAtPoint?: (worldX, worldY) => Hit | null` prop. SceneCanvas builds it from its registry + adapter and passes it in. Canvas's `pickEvery`/`kindOf`/synthesizer block goes away.

### Task 4.1: Add `getNodeAtPoint` prop to Canvas; delete the synthesizer

**Files:**
- Modify: `src/canvas/Canvas.tsx:697-732` (delete synthesizer; install supplied prop instead)
- Modify: `src/canvas/Canvas.tsx:148-274` (add prop)
- Modify: `src/canvas/Canvas.tsx:155-180` (delete `pickEvery`, `boundsOf` from `CanvasProps` if no longer used internally — verify they're not load-bearing for the existing layer factories first)
- Modify: `src/canvas/SceneCanvas.tsx:728-738` (build `getNodeAtPoint` from `internalPickEvery` + registry; pass to Canvas), `:991` (replace `pickEvery={internalPickEvery}` with `getNodeAtPoint={...}` — or keep pickEvery if Canvas still needs it for HUDs)

- [ ] **Step 1: Export the `getNodeAtPoint` builder from a stable site**

The synthesizer block at `Canvas.tsx:699-732` is general-purpose: given pickEvery + (optionally) a kindOf function, return a Hit. Extract it to a new utility file or co-locate with `sceneAdapter.ts`:

```ts
// src/canvas/getNodeAtPoint.ts
export type Hit = { id: string; kind: string } | null;

export function makeGetNodeAtPoint(
  pickEvery: (wx: number, wy: number) => string | string[] | null,
  kindOf?: (id: string) => string,
): (wx: number, wy: number) => Hit {
  return (wx, wy) => {
    const result = pickEvery(wx, wy);
    if (!result) return null;
    const id = Array.isArray(result) ? result[result.length - 1] : result;
    if (!id) return null;
    return { id, kind: kindOf?.(id) ?? 'unknown' };
  };
}
```

(Copy the exact algorithm from `Canvas.tsx:699-732` — including any topmost-vs-bottommost selection rules. Don't paraphrase.)

- [ ] **Step 2: Add a test for the extracted helper**

```ts
// src/canvas/getNodeAtPoint.test.ts
import { describe, it, expect } from 'vitest';
import { makeGetNodeAtPoint } from './getNodeAtPoint';

describe('makeGetNodeAtPoint', () => {
  it('returns null when pickEvery returns null', () => {
    const f = makeGetNodeAtPoint(() => null);
    expect(f(0, 0)).toBe(null);
  });

  it('returns topmost id with "unknown" kind when no kindOf is supplied', () => {
    const f = makeGetNodeAtPoint(() => ['a', 'b', 'c']);
    expect(f(0, 0)).toEqual({ id: 'c', kind: 'unknown' });
  });

  it('looks up kind via supplied kindOf', () => {
    const f = makeGetNodeAtPoint(
      () => 'x',
      (id) => (id === 'x' ? 'rect' : 'unknown'),
    );
    expect(f(0, 0)).toEqual({ id: 'x', kind: 'rect' });
  });
});
```

Run, expected: PASS once the helper is implemented.

- [ ] **Step 3: Replace Canvas's inline synthesizer with the supplied prop**

In `Canvas.tsx:697-732`:

Before:
```ts
const installGetNodeAtPoint = useCallback((...) => {
  // ... 30 lines of synthesizing ...
}, [...]);
```

After:
```ts
useEffect(() => {
  if (!getNodeAtPoint) return;
  tools?.dispatcher?.__setGetNodeAtPoint?.(getNodeAtPoint);
}, [tools, getNodeAtPoint]);
```

(Adjust to match the exact wiring shape — read the current `__setGetNodeAtPoint` call site.)

Add `getNodeAtPoint?: (worldX: number, worldY: number) => { id: string; kind: string } | null` to `CanvasProps`.

- [ ] **Step 4: Decide the fate of `pickEvery` on `CanvasProps`**

Question: do any of Canvas's internal layers (debug overlay, HUDs we just lifted) still need `pickEvery`?

- Debug overlay: probably not.
- PickHud: yes — it shows the list of ids at the cursor, which is exactly `pickEvery(cursor)`.

So `pickEvery` stays on `CanvasProps` for the HUDs. But it's no longer used for the dispatcher's `getNodeAtPoint` — the dispatcher gets the higher-level `getNodeAtPoint` prop.

Document the split in the props JSDoc:

```ts
/** Used by PickHud to display the list of ids at the cursor.
 *  Not used for tool routing — see `getNodeAtPoint`. */
pickEvery?: (worldX: number, worldY: number) => string | string[] | null;

/** Resolves a single hit (id + kind) at world coords for the tool
 *  dispatcher. SceneCanvas synthesizes this from its kind registry. */
getNodeAtPoint?: (worldX: number, worldY: number) => { id: string; kind: string } | null;
```

- [ ] **Step 5: Wire SceneCanvas to pass `getNodeAtPoint`**

In `SceneCanvas.tsx`:

```ts
const getNodeAtPoint = useMemo(
  () => makeGetNodeAtPoint(internalPickEvery, kindClassifier),
  [internalPickEvery, kindClassifier],
);

// in <Canvas>:
getNodeAtPoint={getNodeAtPoint}
// keep pickEvery={internalPickEvery} for the HUDs
```

- [ ] **Step 6: Delete the `adapter.kindOf` cast in Canvas**

`Canvas.tsx:715-724` reads `adapter.kindOf` to enrich the synthesizer. That code is gone now. Confirm no remaining `adapter.kindOf` reads in `Canvas.tsx`.

`src/tools/dispatcher.ts:29` also reads `adapter.kindOf`. That's a separate concern — but it's the same escape hatch. Leave it in place; the existing TODO ("Remove `adapter.kindOf` escape hatch") covers it. The kind information now flows via `getNodeAtPoint`'s return value, not via `adapter.kindOf`. The dispatcher could be migrated to read the Hit's `kind` field instead, but that's a separate task.

- [ ] **Step 7: Run the full suite**

Run: `npm run typecheck && npm run test && npm run test:visual`
Expected: PASS, no new visual diffs.

- [ ] **Step 8: Commit**

```bash
git add src/canvas/Canvas.tsx src/canvas/SceneCanvas.tsx src/canvas/getNodeAtPoint.ts src/canvas/getNodeAtPoint.test.ts
git commit -m "refactor(canvas): lift getNodeAtPoint synthesizer out of Canvas; SceneCanvas supplies it"
```

---

## Phase 5: Canvas props audit

By this point Canvas has gained `viewport`, `backgroundFill`, `cursorCoordsHud`, `pickHud`, `onBackgroundClick`, `getNodeAtPoint` and lost `selectionMode`, `selectionOptions`, the internal `useSelection`, the `pickEvery`-based synthesizer, the `adapter.kindOf` read. Walk every remaining prop and ask: does this fit the new Canvas identity (WebGL surface + viewport + pointer routing + slot composition)?

### Task 5.1: Audit `CanvasProps`

**Files:**
- Modify: `src/canvas/Canvas.tsx:148-274` (props interface)

- [ ] **Step 1: List every prop with a one-line note**

For each prop, write: (kept | removed | deprecated) with a reason.

Expected outcome list (verify against the actual interface):
- `width`, `height` — kept (surface dims).
- `adapter` — kept; it's now mostly an opaque thing Canvas threads to consumer layers. Document that Canvas does not read scene-shaped methods (`kindOf`, etc.) — only the layer slots may.
- `layers` — kept (slot composition).
- `tools` — kept (dispatcher).
- `view`, `defaultView`, `onViewChange` — kept (controlled view).
- `viewport` — kept (new in Phase 1).
- `selection` — kept (optional pass-through).
- `onBackgroundClick` — kept (new in Phase 3).
- `pickEvery` — kept (for HUDs).
- `boundsOf` — verify usage; if only the deleted synthesizer used it, remove.
- `getNodeAtPoint` — kept (new in Phase 4).
- `backgroundFill` — kept (new in Phase 2).
- `cursorCoordsHud`, `pickHud` — kept (new in Phase 2).
- `debug`, `shaders` — kept.
- `previewIdsExtra`, `previewPoseExtra` — kept (preview-ghost integration; SceneCanvas drives).

If any prop in the actual interface doesn't fit the new identity, mark it for removal/deprecation and update SceneCanvas to stop passing it.

- [ ] **Step 2: Remove dead props**

For each `removed` item: delete from interface, delete the consuming code, delete the SceneCanvas-side passthrough.

- [ ] **Step 3: Tighten JSDoc on Canvas's class-level comment**

The current Canvas docstring should be updated to reflect its new contract. Suggested wording:

```ts
/**
 * Low-level WebGL surface + viewport + pointer routing primitive.
 * Composes layers into a single GL render pass, applies a view
 * transform, routes pointer/keyboard events to the supplied
 * `tools.dispatcher`, and exposes scene-agnostic slot props
 * (`backgroundFill`, `cursorCoordsHud`, `pickHud`, `onBackgroundClick`).
 *
 * Canvas owns NO scene-shaped state — selection, picking, kind
 * registry, scene-aware overlays — all live in `<SceneCanvas>` (the
 * public consumer entry point) which wraps `<Canvas>`.
 *
 * @internal
 * @deprecated Bare `<Canvas>` is not a supported consumer surface.
 *   Use `<SceneCanvas>` instead. Re-promotion is tracked in
 *   `docs/TODO.md`.
 */
```

- [ ] **Step 4: Run the full suite**

Run: `npm run typecheck && npm run test && npm run test:visual`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/canvas/Canvas.tsx src/canvas/SceneCanvas.tsx
git commit -m "refactor(canvas): audit CanvasProps; tighten interface to new identity"
```

---

## Phase 6: Docs + TODO

### Task 6.1: Update TODO.md

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 1: Update the "Drop public `Canvas` export" entry**

The entry currently reads (around line 355):

```markdown
- **(P2) Drop the public `Canvas` export entirely** in the next minor. Currently retained for one cycle with a CHANGELOG deprecation note. Internal consumers (`SceneCanvas`, test files) keep importing it directly from `src/canvas/Canvas`.
```

Update to note that the seam refactor landed and re-promotion is now a clean decision:

```markdown
- **(P2) Decide Canvas's public-surface fate.** The seam refactor (2026-05-24) cleaned up Canvas to be a genuine scene-agnostic primitive (WebGL surface + viewport + pointer routing + slot composition; no selection/picking/kind-registry). Two paths:
  - Drop the public `Canvas` export entirely in the next minor (originally planned). Internal consumers (`SceneCanvas`, test files) keep importing from `src/canvas/Canvas`.
  - Re-promote `<Canvas>` as a public scene-agnostic primitive. Real consumer pull from force-graph-style use cases — `<SceneCanvas>` is too opinionated for stores that aren't `Scene<...>`-shaped.
  No public-surface change shipped with the refactor itself.
```

- [ ] **Step 2: Note the `adapter.kindOf` follow-up unblocked**

The existing TODO entry "Remove `adapter.kindOf` escape hatch" now has one fewer reader (Canvas-side). Update the file:line reference (the previous reference at `src/canvas/Canvas.tsx:716` no longer exists). The dispatcher-side reader at `src/tools/dispatcher.ts:29` is the only remaining one and is straightforward to migrate.

- [ ] **Step 3: Commit**

```bash
git add docs/TODO.md
git commit -m "docs(todo): record Canvas/SceneCanvas seam refactor outcome"
```

### Task 6.2: Final verification

- [ ] **Step 1: Run the full release-gate locally**

Run: `npm run prepublishOnly`
Expected: PASS (this runs `tsc --noEmit && vitest run && tsup build && build:demo`).

- [ ] **Step 2: Run the visual regression suite end-to-end**

Run: `npm run test:visual`
Expected: PASS with zero new diffs.

- [ ] **Step 3: Hand verification via the demo harness**

Start: `npm run dev:kit` (background)
Visit `http://localhost:5173/#shape-tools`, `#scene`, `#multi-select`, `#viewport`, `#zoom`, `#parallax`, `#bezier-edit`.
For each: select-on-click, multi-select-marquee, drag-to-move, resize-handles, rotate, pan, zoom — confirm behavior matches main.

- [ ] **Step 4: Hand verification via swillustrator**

Start: `npm run --workspace apps/swillustrator dev` (background; confirm the actual package path)
Confirm: tool palette renders, drawing works, viewport pan/zoom works, selection/multi-select works, background fill renders correctly behind the page.

- [ ] **Step 5: Report status**

Plan complete. Summarize what shipped, what's deferred, and any surprises encountered during execution.

---

## Risk hot spots (for the executing agent)

- **Phase 3 selection move** is the highest-risk phase. The outside-click backstop semantics are notoriously easy to break (clicks landing on tool overlays should NOT clear selection; clicks landing on background SHOULD). Test by hand in addition to the automated tests.
- **Phase 1 viewport move** interacts with the gesture dispatcher. If `viewport.pan` / `viewport.zoom` descriptors don't register correctly after the lift, all viewport interactions silently break. The dep-registry assertion in the test is the primary tripwire.
- **Phase 4 picking move** changes the shape of what flows into the dispatcher. If the dispatcher expects the Hit's `kind` field to be present and SceneCanvas's classifier returns `'unknown'` for an unregistered kind, tool routing tables that key off specific kinds will silently no-op. Smoke-test by clicking a shape under each registered kind.
- **All phases** must keep `@internal` / `@deprecated` on Canvas. Do not export Canvas from `src/index.ts`. Do not add public documentation for Canvas. The point of this refactor is to make re-promotion *possible*, not to do it.

## What this plan deliberately does NOT do

- Re-promote `<Canvas>` to public — separate decision.
- Delete `adapter.kindOf` from the adapter contract — separate TODO.
- Split `src/canvas/Canvas.tsx` or `src/canvas/SceneCanvas.tsx` into smaller files — entangles the diff.
- Migrate the `useSceneAdapter` lift (separate TODO entry "SceneCanvas → useSceneAdapter").
- Touch the `useScene` op-log serialization, layout strategies, or any other scene-internal concern.

If any of these tempt you mid-execution: stop, finish the current phase, and file a follow-up.
