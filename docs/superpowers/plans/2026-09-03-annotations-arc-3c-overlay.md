# Annotations arc 3c — the overlay and the palette bridge

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** An instrument that declares `annotations` gets a live drawing overlay on each of its targets — weasel tools, weasel selection, marks that pan and zoom with what they mark — driven from the trial's tool palette.

**Architecture:** Each target gets a transparent input box over its element and a `<SceneCanvas>` that paints into the lab's one shared canvas at that box's rect (arc 1's `setTarget`, arc 2's `paintInto` / `inputElement`). The scene is 3b's mark scene; the store is unchanged. A labkit tool id drives weasel's `ActiveToolContext` through a bridge, and an `insertNodeFactory` mints `AnnotationData` so a drawn shape *is* a mark, not a shape the store has to be told about afterwards.

**Scope boundary.** 3c is the overlay and the bridge. **Persistence stays out** — the store lives for the trial's lifetime and marks do not survive a reload. Undo delegation, the meaning chrome (statuses, a mark list) and the storage slot are 3d; capture is arc 4. Nothing here reads `AnnotationMeaning`.

**Tech stack:** React 19, TypeScript, `@weasel-js/core` (`SceneCanvas`, `WeaselProvider`, `useActiveToolContext`, `InsertNodeFactory`), vitest (`--project=labkit`), Playwright for anything the GL path decides.

**Spec:** `docs/superpowers/specs/2026-09-02-labkit-annotations-design.md`, arc 3.

---

## What is missing underneath, and why task 1 exists

`<Lab>` mounts a `useTiledSurface` but no canvas and a `NO_FRAME` callback: tiles register and stay measured, and nothing paints. `paintInto` needs a real `HTMLCanvasElement`, so the surface has to grow one before an overlay can exist.

Two consequences shape task 1:

- **A shared buffer resize clears every pane.** `canvas.width = …` wipes the whole drawing buffer, so a resize has to reach every pane, not only the one that moved. That is what `invalidateAll` is for; the frame after a resize repaints all of them.
- **A pane paints on its own frame loop, so the surface must be able to wake it.** `SurfaceHandle` gains `registerPainter(id, fn)`; the surface calls each dirty tile's painter with its rect, and a pane's painter is "take this rect, and ask my canvas to redraw".

## Deviations from the spec

- **The default camera is a fit, not the identity.** The spec says world is the target's content box in CSS px at zoom 1 and the camera is "a plain scale". A target that declares no `view` therefore gets `zoom = rect.w / content.w` rather than 1, or a mark drawn on a scaled-down pane lands off-screen.
- **`arrow` and `stroke` have no weasel tool of their own.** They ride `line` and `pencil`; the annotation kind comes from the labkit tool id the overlay is holding, not from the weasel insert kind, which cannot tell them apart.

---

## File structure

**Created — `packages/labkit/src/annotations/`**
- `AnnotationsContext.ts` — the context, `useAnnotations()`, `useAnnotationsOptional()`
- `view.ts` + `view.test.ts` — labkit `ViewTransform` ↔ weasel `View`, and the fit view a target with no camera gets
- `toolMap.ts` + `toolMap.test.ts` — `ANNOTATION_TOOLS` (the palette's `TrialTool[]`), and annotation tool id → weasel tool id + annotation kind
- `paint.ts` + `paint.test.ts` — a mark node → `DrawCommand[]`, per kind
- `AnnotationOverlay.tsx` — one target's box, tile, provider scope and `SceneCanvas`
- `AnnotationTargets.tsx` — the capability's targets → overlays
- `Annotations.overlay.test.tsx` — what jsdom can see of the above

**Modified**
- `packages/labkit/src/surface/useTiledSurface.ts` — `registerPainter`, and painter dispatch in the frame
- `packages/labkit/src/surface/SurfaceContext.ts` — `SurfaceCanvasContext`
- `packages/labkit/src/surface/useSurfaceTile.ts` — `useSurfaceCanvas()`
- `packages/labkit/src/surface/index.ts` — exports
- `packages/labkit/src/lab/Lab.tsx` — mount and size the shared canvas; provide it
- `packages/labkit/src/lab/LabShell.less` — `.lk-lab__body { position: relative }` and `.lk-lab__surface`
- `packages/labkit/src/trial/Trial.tsx` — build the store, provide it, mount the targets
- `packages/labkit/src/chrome/builtins.tsx` — the annotation tools' palette contributions
- `packages/labkit/src/index.ts` + `index.test.ts` — public surface

---

### Task 1: the surface grows a canvas and can wake a pane

- [ ] **Failing test first** (`surface/useTiledSurface.test.tsx`): a registered painter is called with its tile's rect on the frame its tile is dirty, is not called for a clean tile, and stops being called after its unregister. Assert the rect, not just the call — a painter handed the wrong origin paints the right picture in the wrong place, which no `toHaveBeenCalled` catches.
- [ ] Add `registerPainter(id, fn): () => void` to `SurfaceHandle`; dispatch to painters inside the existing frame, after `onFrame`, so the owner has already resized the buffer.
- [ ] Add `SurfaceCanvasContext` + `useSurfaceCanvas()`; export both.
- [ ] In `Lab.tsx`, render `<canvas className="lk-lab__surface">` as a child of `.lk-lab__body`, hold it in state, provide it. Replace `NO_FRAME` with a handler that sizes it to `size × dpr` and calls `invalidateAll()` when the size changed. A lab deferring to an outer surface mounts no canvas and provides whatever the outer one provides.
- [ ] `.lk-lab__body` gets `position: relative`; `.lk-lab__surface` is absolutely positioned, `pointer-events: none`, above the workspace. **Do not put the canvas between `.lk-lab__body` and `.lk-workspace`** — the existing `> .lk-workspace { min-width: 0 }` is a direct-child rule and a wrapper drops it. A sibling is fine; the existing adjacency test guards it.
- [ ] `npx vitest run --project=labkit surface` green; commit.

### Task 2: the camera a target draws through

- [ ] **Failing test first** (`view.test.ts`): `fitView({ content: { w: 256, h: 170 } }, { w: 512, h: 340 })` is `zoom 2, pan 0`; a target's own `ViewTransform` converts to a weasel `View` and back unchanged; a zero-sided content box yields zoom 1 rather than `Infinity`.
- [ ] Implement `toWeaselView(v: ViewTransform): View`, `fromWeaselView(v: View): ViewTransform`, `fitView(content, rect): ViewTransform`.
- [ ] Tests pass; commit.

### Task 3: the tool table

- [ ] **Failing test first** (`toolMap.test.ts`): every `AnnotationKind` has an entry; every entry's weasel tool id is one `SceneCanvas` will mount (assert against `KIT_SHAPE_KINDS` + `select`, imported, not retyped); `select` maps to no kind; `arrow` and `stroke` map to `line` and `pencil` respectively and keep their own kind.
- [ ] Implement `ANNOTATION_TOOLS: readonly TrialTool[]` (select, stroke, line, arrow, rect, ellipse, text — icons from `@weasel-js/ui`) and `annotationToolInfo(id)` returning `{ weaselTool, kind? }`.
- [ ] Tests pass; commit.

### Task 4: painting a mark

- [ ] **Failing test first** (`paint.test.ts`), one `it` per kind: a `rect` mark emits a stroked rect path at its pose; `ellipse` an ellipse; `line` a segment through its two `points` converted to world; `arrow` the segment **plus** a head whose vertex is at the second point — compute the expected vertex, do not eyeball it; `stroke` a polyline through every point; `text` a text command carrying `title`. Plus: a mark with a `points`-shaped kind and no `points` falls back to its pose diagonal rather than emitting nothing.
- [ ] Implement `markCommands(node, content)` in `paint.ts`. Pure: a node and the target's content box in, `DrawCommand[]` out. No React, no DOM.
- [ ] Tests pass; commit.

### Task 5: the overlay

- [ ] Write `AnnotationsContext.ts` — `useAnnotations()` throws with the labkit-prefixed message the other hooks use; `useAnnotationsOptional()` returns null.
- [ ] Write `AnnotationOverlay.tsx`. It registers the *target's own element* as the surface tile (that is the box whose rect we want), holds the rect from its painter, and renders a transparent absolutely-positioned input box at that rect inside the surface container, plus:
  - `<WeaselProvider isolate>` — one scope per pane. A shared `<ActionsProvider>` lets only the newest canvas respond to input and the rest go silently dead.
  - a bridge component inside that scope pushing the trial's resolved tool id through `useActiveToolContext().setActive`.
  - `<SceneCanvas>` with `paintInto={{ canvas, x: rect.x, y: rect.y }}`, `inputElement`, `width`/`height` from the rect, `scene` from the store, `view` from the target or `fitView`, `defaultTools` from the tool table, `layers={{ scene: { drawOne } }}` calling `markCommands`, and `insertNodeFactories` minting `AnnotationData` for every mapped kind.
  - The factory reads the live labkit tool id from a ref — `arrow` and `stroke` are indistinguishable from `line` and `pencil` at the weasel end.
- [ ] Write `AnnotationTargets.tsx`: calls `capability.targets(state, config)` and renders one overlay per target. A target whose `ref` is not yet attached renders nothing rather than measuring null.
- [ ] `Annotations.overlay.test.tsx`: with a stub surface above, an instrument declaring two targets mounts two input boxes with the right tile ids and the right rects, and unmounting unregisters both. **Say in the test that GL is not exercised here** — jsdom's canvas has no WebGL2, `Canvas`'s paint bails silently, and an assertion about pixels here would be an assertion about jsdom.
- [ ] Commit.

### Task 6: wiring

- [ ] `Trial.tsx`: build the mark scene and store once per trial (a ref, seeded empty — persistence is 3d), provide it, and render `<AnnotationTargets>` when `instrument.annotations` is declared. The store's `targets()` thunk re-reads the capability so a resize or a new dependency needs no rebuild.
- [ ] `chrome/builtins.tsx`: contribute `ANNOTATION_TOOLS` to the `palette` region when `instrument.annotations != null`, the way `instrument.tools` already does. Note the id-collision rule already documented there — an annotation tool id shares the contribution namespace.
- [ ] Make the trial's tool slot resolve for an annotating instrument that declares no `tools` of its own: it needs its own slot, not the lab's, or two trials share one tool.
- [ ] Export the new public surface from `index.ts`; assert it in `index.test.ts`.
- [ ] Commit.

### Task 7: gate

- [ ] `npx tsc --noEmit && npm run lint && npm test`, all in the foreground, output read.
- [ ] `npx playwright test --config=tests/visual/playwright.config.ts`.
- [ ] **Screenshot it.** This arc changes a container's box and adds a full-bleed canvas over the lab body; jsdom cannot see a layout collapse and did not see the last one. Put the render on the slopboard wall and look at it before claiming the arc works.
- [ ] Changeset, `patch`. `npm run check:bumps`.

---

## Merging

`git merge main` then `git -C .claude/worktrees/trunk merge --ff-only labkit/annotations`. Leave that worktree. **`main` has never been pushed; pushing needs Mike's explicit say-so.** Delete this plan in the merge commit.
