# Document modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pages become scene containers. A page frames and clips its children, and a page-run container lays the pages out in a row or column. The engine then offers Continuous (no pages) and Pages modes, with an opt-in pasteboard and `continuous`/`single` paging.

**Architecture:** Core keeps the public page API's names and types (`Page`, `PlacedPage`, `PageLayoutOptions`, `placedPagesOf`, `pagesOf`, `addPage`, `removePage`, `movePage`, `resizePage`, `renamePage`, `setPages`, `pageMembers`, `pageAt`, `pageOfBounds`, `pageHolding`, `pagesLayer`, `fitViewToPage`, `pageInView`, `adjacentPage`, `layoutPages`) and reimplements the stateful ones over nodes. Readers that only use page geometry therefore don't change. What migrates is every producer that places content in world space in a paged scene, and every reader that works out membership from geometry. A scene stored with the old `core:pages` doc value is converted on load by one core function.

**Tech Stack:** TypeScript, React, vitest (jsdom + browser projects), npm workspaces.

**Spec:** `docs/superpowers/specs/2026-11-02-document-modes-design.md`

## Global Constraints

- Every changeset is `patch` (CLAUDE.md, "Releases").
- No source file over 400 lines or function over 120 (`npm run check:size`).
- A page's data is a kit-owned node field, never the consumer's `data`.
- Page and page-run nodes sit on the scene's lowest layer, since a child may not sit below its parent's layer (`layerStack.ts`).
- Pages are 2D only; a kernel3d scene gets Continuous.
- `core:pages` is replaced, not kept as a second path. `PAGES_DOC_KEY` survives only as the key the load conversion reads.
- Tests run one file at a time, `--maxWorkers=1`, under the project that owns the directory (`npm run check:test-projects`). Full suites go to the fleet via `npm run test:fleet` only.
- US English; prose rules from CLAUDE.md for docs and changesets.

## Review Focus

1. **Undo of a page edit restores both the pages and their content, as one entry.** Add, remove, move and resize each undo in one step.
2. **Hiding or locking a layer must not hide or lock the pages.** Content on that layer is affected; the paper is not.
3. **Select-all, marquee, Delete and Cmd+G never take a page or the run.** A marquee starting on empty paper selects content, not the page.
4. **A child on a higher layer than its page is still clipped by the page.** Clipping has to work across layers, not only within one layer's render pass.
5. **Loading a legacy `core:pages` scene twice is idempotent.** The second load is a no-op, and a scene with content off every page loads it onto the nearest page.

---

### Task 1: Page and page-run nodes in core

**Files:**
- Modify: `packages/core/src/core/scene/types.ts` (node fields), `packages/core/src/core/pages/pages.ts`, `packages/core/src/core/pages/pageEdits.ts` (split as needed to stay under 400 lines)
- Create: `packages/core/src/core/pages/pageNodes.ts` (fields, run lookup, page lookup), `packages/core/src/core/pages/pageRunLayout.ts` (the layout strategy), `packages/core/src/core/pages/legacyPages.ts` (load conversion)
- Modify: `packages/core/src/barrel/viewport.ts`; scene serialization wherever `layout`/`units`/`clip` are serialized (find with `grep -rn "units" packages/core/src/core/scene/*.ts`; the editor's `packages/editor/src/snapshot.ts` too)
- Test: `packages/core/src/core/pages/pageNodes.test.ts`, `pageRunLayout.test.ts`, `legacyPages.test.ts`; update `pages.test.ts`, `pageEdits.test.ts`

**Interfaces:**
- Produces:
  - Node fields: `page?: PageInfo` and `pageRun?: PageRunInfo` on `NodeBase` and `AddNodeSpec`, where `interface PageInfo { readonly name?: string; readonly meta?: Readonly<Record<string, unknown>> }` and `interface PageRunInfo extends PageLayoutOptions { readonly pasteboard?: boolean }`. A page node's pose is a rect `{ x, y, width, height }` local to the run (the strategy writes `x, y`).
  - `createPageRun(scene, pages: readonly Page[], options?: PageLayoutOptions & { pasteboard?: boolean; layer?: TLayer }): NodeId`: adds the run (a root `group`) and one child `group` per page, on the lowest layer unless `layer` is given, in one batch. The page node id is the `Page.id`.
  - `pageRunOf(scene): NodeId | null`: the root node with a `pageRun` field. `isPaged(scene): boolean`.
  - `pageOfNode(scene, id): string | null`: the id of the nearest ancestor with a `page` field, or `id` itself if it is a page.
  - `pageRunLayout(): LayoutStrategy<RectPose>`: places the run's page children with `layoutPages` arithmetic, reading `PageRunInfo` from the container node. The run's own pose is at `origin`.
  - `pagesOf(scene): PagesDoc | null` and `placedPagesOf(scene): PlacedPage[]` read the nodes. Placed `x, y` are world coordinates, as today.
  - `setPages`, `addPage`, `removePage`, `movePage`, `resizePage`, `renamePage`: same signatures, editing page nodes. A page's children are never rewritten; they move with it. `removePage` deletes the page node and its subtree, plus every node that `dependsOn` something in that subtree.
  - `pageMembers(scene, placed?)`: same return shape, read from the tree (direct children of each page). The `descriptor` parameter is accepted and ignored.
  - `adoptLegacyPages(scene, options?: { descriptor? }): boolean`: when `scene.doc` holds `PAGES_DOC_KEY`, builds the run with those pages and layout. Each root is reparented into its page, chosen by `pageHolding` on its effective world bounds, with its pose rewritten into the page's frame (followers, i.e. `dependsOn` nodes, go into the run). The doc value is then deleted. All of this is one batch, labeled `'Adopt pages'`, and is not undoable (use the scene's untracked batch if one exists, else `scene.batch` then clear history; check `historyFacade.ts`). Returns whether it converted.
  - `pageAt`, `pageOfBounds`, `pageHolding`, `layoutPages`, `pagesBounds`, `adjacentPage`, `pageName` keep their signatures; they are pure arithmetic over `PlacedPage`.

- [ ] **Step 1:** Write failing tests in `pageNodes.test.ts`:
  - `createPageRun` with two 100×50 pages and `{ direction: 'row', gap: 10 }`: `placedPagesOf` gives `[{ id:'a', x:0, y:0 }, { id:'b', x:110, y:0 }]`.
  - A child at local `{ x: 5, y: 5 }` on page `b` has world pose `x: 115`.
  - `movePage(scene, 'b', 0)` gives that child world `x: 5` with its stored pose unchanged, and one `scene.history.undo()` puts it back at 115.
  - `resizePage(scene, 'a', { width: 200, height: 50 })` moves page `b` to `x: 210`.
  - `removePage` deletes the page's subtree and a follower that depends on it.
  - `pageOfNode` finds a grandchild's page.
- [ ] **Step 2:** Write failing tests in `legacyPages.test.ts`:
  - A scene with `PAGES_DOC_KEY` of two pages and a world-space rect at `x: 115` on page `b`: after `adoptLegacyPages`, the rect's parent is `b`, its stored `x` is `5`, `scene.doc.get(PAGES_DOC_KEY)` is undefined, and undo history is empty.
  - A second call returns `false`.
  - A rect in the gap between pages lands on the nearer page.
- [ ] **Step 3:** Run them under `--project=core`, one file at a time; they fail.
- [ ] **Step 4:** Implement the fields (with serialization through every path that serializes `units`), `pageNodes.ts`, `pageRunLayout.ts`, the rewritten edits, and `legacyPages.ts`. Export the new names from `barrel/viewport.ts`.
- [ ] **Step 5:** Update `pages.test.ts` and `pageEdits.test.ts` to build scenes with `createPageRun` instead of `scene.doc.set(PAGES_DOC_KEY, …)`. Run all four page test files, one at a time; they pass.
- [ ] **Step 6:** `npm run typecheck:packages -- core`; eslint on the changed files; `npm run check:size`. Commit: `make pages scene containers laid out by a page run`.

### Task 2: Paper, clipping and gates

**Files:**
- Modify: `packages/core/src/core/pages/pagesLayer.ts`, `packages/core/src/core/scene/nodeGates.ts` (or wherever select-all, marquee, delete and group gate nodes; find with `grep -rn "pickable" packages/core/src/interactions/actions`), the render walk's clip handling if clipping does not cross layers
- Test: `packages/core/src/core/pages/pageGates.test.ts`; a clipping case in `packages/core/src/core/pages/pageClip.browser.test.tsx` only if jsdom cannot see the clip commands (prefer asserting the draw command list in jsdom)

**Interfaces:**
- Consumes: Task 1's nodes.
- Produces: page nodes clip their children to their rect, through `clipFromPose` returning the pose rect, registered with the clip registry under the key `'core:pageClip'`. Page and run nodes are `pickable: false`. They are skipped by select-all, marquee, lasso, delete, group, align and distribute, and by `nodeAtPoint`. Pressing empty paper behaves as pressing empty canvas. The paper is still painted by `pagesLayer(placedPagesOf(scene), …)`; pages draw nothing themselves.

- [ ] **Step 1:** Write failing tests:
  - Select-all on a paged scene with one rect selects only the rect.
  - `nodeAtPoint` on empty paper returns null.
  - Delete with a page id forced into the selection deletes nothing.
  - A rect overhanging its page's right edge renders inside a group carrying the page's clip, also when the rect is on a layer above the page's.
  - Hiding the content layer leaves `pagesLayer` output unchanged.
- [ ] **Step 2:** Run them; they fail.
- [ ] **Step 3:** Implement through the existing gate mechanism. Add a page predicate there; do not scatter `node.page` checks across actions. If clipping does not cross layers in the render walk, fix it there for every clipping container, not for pages alone.
- [ ] **Step 4:** Run the new and touched test files; they pass. Typecheck core, eslint, `check:size`. Commit: `clip page content to its page and keep pages out of selection`.

### Task 3: Moving, inserting and pasting in a paged scene

**Files:**
- Modify: `packages/core/src/interactions/actions/insert/parent.ts`, `packages/core/src/interactions/actions/move/behaviors/reparentOnDrop.ts` and `move/commit/reparent.ts`, the clipboard paste path (`packages/core/src/interactions/actions/clipboard/materializePaste.ts`)
- Create: `packages/core/src/core/pages/pagePlacement.ts` (the rules, as pure functions over a scene)
- Test: `packages/core/src/core/pages/pagePlacement.test.ts`, plus one action-level test each for move, insert and paste beside the existing tests in those folders

**Interfaces:**
- Consumes: Task 1 (`pageRunOf`, `pageOfNode`, `placedPagesOf`, `PageRunInfo.pasteboard`).
- Produces:
  - `pageForPoint(scene, world: {x,y}): string | null`: the page under the point. With no page there: `null` if the pasteboard is on, else the nearest page (`pageHolding`).
  - `keepOnPage(pageRect: Bounds, bounds: Bounds): { dx: number; dy: number }`: the smallest shift that leaves at least 1 world unit of `bounds` overlapping `pageRect`.
  - In a paged scene, the move action reparents a dragged root whose parent is a page:
    - into the page under the release point, keeping its world position;
    - with the pasteboard on, to the root when released over no page;
    - with the pasteboard off, a release over no page keeps it in its page, shifted by `keepOnPage`.

    This happens whatever the binding's `reparentOnDrop` param says. Moves within one page, and moves of nodes nested deeper than a page's direct child, are unchanged.
  - Insert and paste in a paged scene with no `insertInto` target: the parent is the page from `pageForPoint` (the insert's press point; the paste's anchor), and the new node is shifted by `keepOnPage` when the pasteboard is off. With the pasteboard on and no page under the point, the parent is the root. Followers (`dependsOn`) created by any of these go into the run.

- [ ] **Step 1:** Write failing tests in `pagePlacement.test.ts` for `pageForPoint` (on a page; in the gap with pasteboard off → nearer page; in the gap with pasteboard on → null) and for `keepOnPage` (inside → `{0,0}`; wholly right of the page by 50 → `dx` brings 1 unit back on).
- [ ] **Step 2:** Write failing action tests:
  - A rect dragged from page `a` to page `b` ends as `b`'s child at the same world position, in one undo entry.
  - With the pasteboard off, a rect dragged far off every page stays `a`'s child, overlapping it.
  - With the pasteboard on, the same drag makes it a root.
  - A rect inserted in the gap lands in the nearer page.
  - A paste far away lands on the nearest page, overlapping it.
- [ ] **Step 3:** Run them; they fail.
- [ ] **Step 4:** Implement. The move change is a behavior in the move pipeline that claims the commit before `reparentOnDrop`, not a branch inside it. Insert goes through `insertParent` and paste through its parent choice, both calling `pageForPoint`.
- [ ] **Step 5:** Run the new tests and the existing test files in `move/`, `insert/` and `clipboard/` that touch parents, one at a time; they pass. Typecheck core, eslint, `check:size`. Commit: `place moved, inserted and pasted content on pages`.

### Task 4: Editor shell, paper and paging

**Files:**
- Modify: `packages/editor/src/usePages.ts`, `packages/editor/src/paperLayer.ts`, `packages/editor/src/usePageFit.ts`, `packages/editor/src/snapshot.ts` (call `adoptLegacyPages` after a load), `packages/editor/src/index.ts`, `packages/editor/README.md`
- Create: `packages/editor/src/usePageSettle.ts`
- Test: `packages/editor/src/usePages.test.ts`, `packages/editor/src/usePageSettle.test.ts`, the snapshot test

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces:
  - `usePages(scene, view, dims, setView, padding?, options?: { paging?: 'continuous' | 'single' })`, same `DocPages` result. `add()` creates the run with `createPageRun` when the scene has none.
  - `usePageSettle(pages: DocPages, view, dims, setView, paging)`: with `'single'`, 150 ms after the last view change it animates (`view.animate` when the view dep has it, else sets) to `fitViewToPage` of the page `pageInView` reports, or the nearest by `pageHolding` of the view rect. With `'continuous'` it does nothing. It never runs while a pointer is down.
  - `docFromSnapshot` (and whatever loads a session) calls `adoptLegacyPages` on the scene it builds.

- [ ] **Step 1:** Write failing tests:
  - `usePages.add()` on a Continuous scene makes it paged, with one page of the default size.
  - `usePageSettle` with `'single'` settles a view left between two pages onto the nearer, after 150 ms of fake timers.
  - With `'continuous'` it never calls `setView`.
  - A snapshot holding `core:pages` loads as page nodes.
- [ ] **Step 2:** Run them under the project that owns `packages/editor`; they fail.
- [ ] **Step 3:** Implement. Wire `usePageSettle` inside `usePages` from its `paging` option, so callers get it by passing the option.
- [ ] **Step 4:** Run the editor's test files one at a time; they pass. Typecheck editor, eslint, `check:size`. Update the README's "Pages" row and prose for page nodes, modes, pasteboard and paging. Commit: `page nodes, paging and legacy page loads in the editor`.

### Task 5: draw on page nodes

**Files:**
- Modify: `apps/draw/src/openSvg.ts`, `svgPages.ts`, `svgInterop.ts`, `saveSvg.ts`, `svgExport.ts`, `pages/drawPages.ts`, `pageLayers.ts`, `fileCommands.ts`, `Workspace.tsx`, `Toolbar.tsx`, `useViewBounds.ts`, `Editor.tsx`, and their tests (see the file list from `grep -rln "placedPagesOf\|pagesOf\|PAGES_DOC_KEY\|pageMembers\|setPages" apps/draw/src`)

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces:
  - Opening an SVG builds the page run with `createPageRun` and adds each shape as a child of its page, in page-local coordinates.
  - Saving and exporting read world poses (`getWorldPose`) or page-local poses explicitly. The file format does not change: a file saved before this change opens the same, and a file saved after round-trips.
  - A new document is paged with one page of `DEFAULT_PAPER_SIZE`.

- [ ] **Step 1:** Run draw's page-touching test files as they stand, one at a time, and note which fail against Tasks 1–4.
- [ ] **Step 2:** Add a failing round-trip test to `svgPages.test.ts`: a two-page file with a shape on page 2 opens with that shape as page 2's child, and saves to the same page placement.
- [ ] **Step 3:** Migrate the files above. Remove any world-space placement of content onto pages.
- [ ] **Step 4:** Run every draw test file from Step 1, plus the new one, one at a time (browser files go to the fleet alone, by file); they pass. Typecheck, eslint, `check:size`. Commit: `move draw onto page nodes`.

### Task 6: chart on page nodes

**Files:**
- Modify: `apps/chart/src/chartDocument.ts`, `exportCommands.ts`, `pages/AddPageDialog.tsx`, `pages/useFittedView.ts`, chart persistence (load calls `adoptLegacyPages`), and their tests (`grep -rln` as in Task 5 over `apps/chart/src`)

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: chart documents build and edit pages as nodes; a chart saved before this change loads through `adoptLegacyPages`.

- [ ] **Step 1:** Run chart's page-touching test files, one at a time; note the failures.
- [ ] **Step 2:** Add a failing test to `chartPersistence.test.ts`: a stored document with `core:pages` loads with page nodes and its content parented into them.
- [ ] **Step 3:** Migrate.
- [ ] **Step 4:** Run the files from Step 1 plus the new test; they pass (browser files on the fleet, by file). Typecheck, eslint, `check:size`. Commit: `move chart onto page nodes`.

### Task 7: diagram and diagram-formats on page nodes

**Files:**
- Modify: `packages/diagram/src/offPage/{split,tag,follow,install}.ts`, `packages/diagram/src/{dataPages,dataTypes,diagramViewProps,usePagesView}.ts`, `packages/diagram-formats/src/{toScene,fromScene,pageKinds,pageNodes,plotPages}.ts`, `packages/diagram-formats/src/templates/templateScene.ts`, `packages/diagram-formats/src/testing/{authoredScene,docScene,pageScene}.ts`, and their tests
- Test: the existing tests in those folders; add the case below to `offPage.scene.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3 (`pageOfNode`, `createPageRun`, page `meta`).
- Produces:
  - Off-page splitting reads each end's page with `pageOfNode`, not geometry. `split.ts`'s `OffPageEdgeInput` gains `fromPage: string | null` and `toPage: string | null`, and drops the boxes it only used for membership. Keep any box `tag.ts` uses for marker placement.
  - Connectors are children of the run.
  - `toScene` builds pages with `createPageRun` and parents boxes into their page in local coordinates. `fromScene` reads world poses, so file output is unchanged.
  - `diagram:graph` stays in page `meta`.

- [ ] **Step 1:** Run every test file in those folders, one at a time; note the failures.
- [ ] **Step 2:** Add a failing test to `offPage.scene.test.ts`: dragging a box from page 1 to page 2 changes its parent, and its connector to a box on page 1 then splits into markers.
- [ ] **Step 3:** Migrate.
- [ ] **Step 4:** Run the files from Step 1 plus the new test; they pass, and the round-trip tests (`roundTrip.test.ts`, `drawXml/roundTrip.test.ts`) still match their fixtures byte for byte. Typecheck both packages, eslint, `check:size`. Commit: `read diagram pages from page nodes`.

### Task 8: Remaining readers, docs and changeset

**Files:**
- Modify: anything still matching `grep -rn "PAGES_DOC_KEY\|scene.doc.set(.*pages" packages apps` outside `legacyPages.ts` and its test; `packages/ui/src/components/PageTabs/*` if it reads the doc value; `docs/taxonomy.md` (a "Page" entry: page and page run as containers, modes, pasteboard, paging); `packages/core/src/domains/viewports/README.md` if it describes pages
- Create: `.changeset/page-containers.md` (patch, every package touched)
- Delete: `docs/superpowers/specs/2026-11-02-document-modes-design.md` and this plan, once the taxonomy entry carries what stays true (CLAUDE.md, "Plans")

- [ ] **Step 1:** Run the grep. Migrate what it finds.
- [ ] **Step 2:** Write the taxonomy entry. It records the decisions with their dates:
  - pages are containers (2026-11-02);
  - followers live in the run (2026-11-02);
  - the pasteboard is opt-in (2026-11-02);
  - paging is continuous by default (2026-11-02);
  - artboards are deferred (2026-11-02);
  - pages are 2D only.
- [ ] **Step 3:** Write the changeset. Its prose says this is breaking for any consumer that wrote `core:pages` directly or placed content on pages in world coordinates, and that stored scenes convert on load.
- [ ] **Step 4:** `npm run check:bumps`, `npm run check:test-projects`. Delete the spec and the plan. Commit: `document page containers and retire the document-modes plan`.
