# Pages in `DiagramData` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Unbuilt (2026-10-20).** Wave 2 of the fourth arc. Delete this plan when the branch merges.

**Goal:** A data-backed diagram can have pages: `diagramScene` splits a connector whose ends sit on different pages into two stubs with off-page tags, `DiagramView` draws the pages, and weaselchart's pipeline mode shows them under the `nodeGraph` look.

**Architecture:** Two rules exist once already and stay that way. Which page a box belongs to is core's `pageOfBounds`. Which connectors split and with which letter is `offPageSplits` (`packages/diagram/src/offPage/split.ts`), which is already pure. What the live edit pass (`offPage/install.ts`) and `diagramScene` would otherwise both write is the tag's text and its spec, so that moves into `offPage/tag.ts` and both callers use it. `DiagramData` carries `pages` and `pageLayout`, the same pair core's `PagesDoc` holds. `DiagramView` takes placed pages as a prop and paints them with core's `pagesLayer` under the scene.

**Tech Stack:** TypeScript, React, vitest (`weasel-ui` project for `packages/diagram` jsdom tests, `browser` project for `*.browser.test.tsx`), onto fleet.

**Spec:** `docs/superpowers/specs/2026-10-20-chart-fourth-arc-design.md` (row "Pages in `DiagramData`").

## Global Constraints

- Every changeset is `patch`. No `bump-approved` marker.
- No source file over 400 lines and no function over 120 (`npm run check:size`). `fromData.ts` is at 275: the split goes in a new file.
- Every test, typecheck and lint runs on the fleet, never locally. A scoped run is `onto do --kind test -- npx vitest run --project=<project> <file>`; the branch check before merging is `npm run test:fleet -- HEAD`, whose log must show the `fleet-tree: … match <sha>` gate passing.
- Work in a worktree of its own (`.claude/worktrees/arc4-data-pages`), `npm ci` in it before anything builds.
- Ship the conclusion in comments and docs: no comment that restates the code.
- A test that exercises the real canvas (pixels, layers) is a `*.browser.test.tsx`; jsdom tests cover data.

## Decisions made while planning (not in the spec; flagged for review, 2026-10-20)

- **Refs follow data order.** `DataEdge` gains no held ref, so `diagramScene` hands `offPageSplits` no `offPage`, and letters are assigned A, B, … in edge order on every build. Deleting the first split edge re-letters the rest. Chart mode keeps its held refs.
- **Pipeline mode gets Page › Add Page and Delete Page** (otherwise nothing could ever put a page in a pipeline). Add appends a page the size of the last one, or chart's default page size for the first; Delete removes the last page and leaves every stage where it is. No page tabs, Page Setup or page navigation in pipeline mode.
- **Following a tag to its far page** is chart-mode-only; `DiagramView` gets no follow action.
- **A shape in the gap between pages exports to the nearest page.** Export (`documentFromScene`) needs every shape in some page's file, while the split says a gap shape is on no page. Both answers go in core, beside each other: `pageOfBounds` stays "the page it is on, or none" and the split keeps using it; a new `pageHolding` is `pageOfBounds`, else the page whose rect is nearest, the earlier on a tie. `fromScene.ts` uses `pageHolding` in place of `pageOfBounds(...) ?? pages[0]`. Which connectors are cross-page is no longer worked out from the buckets: `fromScene.ts` asks `offPageSplits`, so an exported `crossPageEdges` entry is split exactly when the scene would split it. A connector that isn't split but whose ends export to different pages (one end in a gap) also goes in `crossPageEdges`, keeping its waypoints in world coordinates.

## Review Focus

- **An end in the gap between pages:** the connector stays whole and no tag is made. Test in Task 2.
- **Data with no pages, or `pages: []`:** `diagramScene` returns exactly the specs it returns today. Test in Task 2.
- **Re-lettering:** two split edges read A and B in data order; removing the first makes the second A. Test in Task 2.
- **An edge whose end is a group or a container:** it splits by that group's or container's box, not by a member's. Test in Task 2.
- **`DiagramView router="avoid"` over split edges:** the spec router leaves a split edge out of the avoid pass, as the scene router already does (`avoid/sceneInput.ts`), so its stubs aren't rerouted and its stubs aren't obstacles. Test in Task 3.

---

### Task 1: One copy of the tag text and tag specs

**Files:**
- Modify: `packages/diagram/src/offPage/tag.ts`
- Modify: `packages/diagram/src/offPage/install.ts` (`tagOps`)
- Test: `packages/diagram/src/offPage/tag.test.ts`

**Interfaces:**
- Produces:
  - `offPageFarText(pages: readonly PlacedPage[], split: OffPageSplit, end: 'from' | 'to'): string`: the tag text at `end`, naming the page at the other end with `pageName` and falling back to the raw page id when that page is gone. This is the lookup `tagOps` does inline today.
  - `offPageTagSpecs<TLayer extends string>(edgeId: string, split: OffPageSplit, pages: readonly PlacedPage[], look: OffPageTagLook & { layer: TLayer }): AddNodeSpec<unknown, TLayer, RectPose>[]`: the `from` and `to` tag specs, in that order, built with `offPageTagSpec` and `offPageFarText`.

- [ ] **Step 1: Write the failing tests** in `tag.test.ts`:

```ts
const pages = layoutPages([{ id: 'p1', width: 200, height: 100 }, { id: 'p2', name: 'Detail', width: 200, height: 100 }]);

describe('offPageFarText', () => {
  it('names the page at the other end, by its name or its place', () => {
    const split = { ref: 'A', from: 'p1', to: 'p2' };
    expect(offPageFarText(pages, split, 'from')).toBe('Detail · A');
    expect(offPageFarText(pages, split, 'to')).toBe('Page 1 · A');
  });
  it('falls back to the page id when that page is gone', () => {
    expect(offPageFarText(pages, { ref: 'B', from: 'p1', to: 'gone' }, 'from')).toBe('gone · B');
  });
});

it('offPageTagSpecs makes the from tag then the to tag, each depending on the edge', () => {
  const specs = offPageTagSpecs('e1', { ref: 'A', from: 'p1', to: 'p2' }, pages, { ...LOOK, layer: 'main' });
  expect(specs.map((s) => s.id)).toEqual(['e1/offpage-from', 'e1/offpage-to']);
  expect(specs.every((s) => s.dependsOn?.[0] === 'e1')).toBe(true);
  expect((specs[0]!.data as { text: string }).text).toBe('Detail · A');
});
```

(`LOOK` is the look the file's existing tests use; add one if none exists.)

- [ ] **Step 2: Run to verify they fail**

Run: `onto do --kind test -- npx vitest run --project=weasel-ui packages/diagram/src/offPage/tag.test.ts`
Expected: FAIL, `offPageFarText is not a function`.

- [ ] **Step 3: Implement both in `tag.ts`, and make `tagOps` in `install.ts` take its `text` from `offPageFarText`**, deleting its inline page lookup. `tagOps` still inserts one end at a time with `offPageTagSpec`. Export both from `packages/diagram/src/index.ts` beside `offPageTagText`.

- [ ] **Step 4: Run the tag test and the existing off-page tests**

Run: `onto do --kind test -- npx vitest run --project=weasel-ui packages/diagram/src/offPage`
Expected: PASS, `offPage.scene.test.ts` unchanged and green.

- [ ] **Step 5: Commit**

```bash
git add packages/diagram/src/offPage/tag.ts packages/diagram/src/offPage/install.ts packages/diagram/src/offPage/tag.test.ts packages/diagram/src/index.ts
git commit -m "move off-page tag text and specs into one helper the edit pass calls"
```

### Task 2: `DiagramData.pages` and the split in `diagramScene`

**Files:**
- Modify: `packages/diagram/src/dataTypes.ts` (`DiagramData`)
- Create: `packages/diagram/src/dataPages.ts`
- Modify: `packages/diagram/src/fromData.ts` (`mainSpecs`)
- Modify: `packages/diagram/src/dataEdges.ts` (`edgeSpecs`, `EdgeSpecContext`)
- Modify: `packages/diagram/src/index.ts`, `packages/diagram/README.md` ("Connectors between pages")
- Create: `.changeset/diagram-data-pages.md`
- Test: `packages/diagram/src/fromData.pages.test.ts`

**Interfaces:**
- Consumes: `offPageTagSpecs`, `offPageTagLook`, `offPageSplits`.
- Produces:
  - On `DiagramData`: `pages?: readonly Page[]` and `pageLayout?: PageLayoutOptions` (core's types), documented as "the sheets the diagram is drawn on, in world space as `layoutPages` places them; a node belongs to the page its box overlaps most (`pageOfBounds`)".
  - `diagramPages(data: DiagramData): PlacedPage[]` in `dataPages.ts`: `layoutPages(data.pages ?? [], data.pageLayout)`. Exported from the package.
  - `dataOffPage(edges: readonly { id: string; from: string; to: string }[], pages: readonly PlacedPage[], boxOf: (id: string) => Rect | undefined, look: OffPageTagLook): { splits: ReadonlyMap<string, OffPageSplit>; tags: DiagramSpec[] }` in `dataPages.ts`. Edges whose end has no box are skipped. Only split edges appear in `splits`.
  - `EdgeSpecContext.splits?: ReadonlyMap<string, OffPageSplit>`; `edgeSpecs` writes `offPage: split` into a split edge's `diagram` trait.

- [ ] **Step 1: Write the failing tests** in `fromData.pages.test.ts`. Two 200×100 pages side by side (`p1` x 0..200, `p2` x 240..440), nodes pinned with `at` and `layout: 'none'`:

```ts
it('splits an edge between pages and tags both ends', () => {
  const specs = diagramScene({ ...TWO_PAGES, nodes: [node('a', 20), node('b', 300)], edges: [{ from: 'a', to: 'b' }] }, { layout: 'none' });
  const edge = specs.find((s) => diagramEdgeOf(s) !== null)!;
  expect(diagramEdgeOf(edge)!.offPage).toEqual({ ref: 'A', from: 'p1', to: 'p2' });
  expect(specs.filter((s) => offPageTagOf(s) !== null).map((s) => s.id)).toEqual([`${edge.id}/offpage-from`, `${edge.id}/offpage-to`]);
});
it('leaves an edge with an end in the gap whole', ...);          // node at x 205: no offPage, no tags
it('returns today’s specs for data with no pages or pages: []', ...); // toEqual between {pages: []}, no pages, and the pre-change fixture
it('letters split edges in data order, and re-letters when one goes', ...); // two cross edges → A, B; drop the first → the second is A
it('splits an edge ending at a group by the group’s box', ...);  // group of two nodes on p2, edge a→group from p1 → split to p2
```

- [ ] **Step 2: Run to verify they fail**

Run: `onto do --kind test -- npx vitest run --project=weasel-ui packages/diagram/src/fromData.pages.test.ts`
Expected: FAIL, `offPage` undefined on the edge.

- [ ] **Step 3: Implement.** In `mainSpecs`, after the group and node specs are pushed and before `edgeSpecs`: `const placed = diagramPages(data)`; when it is empty skip everything below. Otherwise build `boxOf` from `placedAt` (nodes and regions, world space) and from the poses of the group specs just pushed (`diagramGroupOf(spec) !== null`), call `dataOffPage` with each kept edge's `edgeIdOf(e)`, `from`, `to`, and `offPageTagLook(theme ?? diagramThemeFrom(undefined))` with `measure` added, so tags measure the way rows do. Pass `splits` in `edgeCtx`, push `tags` after the edge specs. Changeset body: "`DiagramData` takes `pages`: `diagramScene` splits a connector between pages into stubs with off-page tags, as chart mode's edit pass does."

- [ ] **Step 4: Run the new test and the existing `fromData` tests**

Run: `onto do --kind test -- npx vitest run --project=weasel-ui packages/diagram/src/fromData packages/diagram/src/offPage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/diagram/src/dataTypes.ts packages/diagram/src/dataPages.ts packages/diagram/src/fromData.ts packages/diagram/src/dataEdges.ts packages/diagram/src/index.ts packages/diagram/README.md packages/diagram/src/fromData.pages.test.ts .changeset/diagram-data-pages.md
git commit -m "split connectors between pages in diagramScene"
```

### Task 3: `DiagramView` draws pages

**Files:**
- Modify: `packages/diagram/src/diagramViewProps.ts`, `packages/diagram/src/DiagramView.tsx`
- Modify: `packages/diagram/src/avoid/specRoutes.ts` (`createSpecRouter`)
- Test: `packages/diagram/src/DiagramView.pages.browser.test.tsx`, `packages/diagram/src/avoid/specRoutes.test.ts`

**Interfaces:**
- Consumes: `diagramPages`, core's `pagesLayer`, `pagesBounds`.
- Produces: `DiagramViewProps.pages?: { placed: readonly PlacedPage[]; fill: string }`. Painted as a `layers` entry `{ pages: { layer: pagesLayer(placed, { fill }), before: 'scene' } }` on `<SceneCanvas>`, memoized on `pages`. The default fit (`fitDiagram`) also covers `pagesBounds(placed)`.

- [ ] **Step 1: Write the failing tests.**
  - Browser: render `<DiagramView specs={diagramScene(TWO_PAGES_DATA, { layout: 'none' })} pages={{ placed: diagramPages(TWO_PAGES_DATA), fill: '#ff00ff' }} width={600} height={300} />`, read the canvas pixel at the screen point of p2's empty middle, and expect it to be `#ff00ff`; read the pixel between the pages and expect it not to be. Read the canvas with `{ preserveDrawingBuffer: true, stencil: true }` (see CLAUDE.md's stencil trap).
  - `specRoutes.test.ts`: `it('leaves a split edge out of the avoid pass')`: a spec list whose edge has `offPage` set comes back with no `route` on that edge, and the stubs' ends are not among the obstacles the router got.

- [ ] **Step 2: Run to verify they fail**

Run: `onto do --kind test -- npx vitest run --project=browser packages/diagram/src/DiagramView.pages.browser.test.tsx` and `onto do --kind test -- npx vitest run --project=weasel-ui packages/diagram/src/avoid/specRoutes.test.ts`
Expected: FAIL (pixel is the background; the edge has a `route`).

- [ ] **Step 3: Implement** the prop, the layer and the fit in `DiagramView.tsx`, and in `createSpecRouter` `continue` past an edge whose trait has `offPage`.

- [ ] **Step 4: Run both again**: Expected PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/diagram/src/diagramViewProps.ts packages/diagram/src/DiagramView.tsx packages/diagram/src/avoid/specRoutes.ts packages/diagram/src/DiagramView.pages.browser.test.tsx packages/diagram/src/avoid/specRoutes.test.ts
git commit -m "draw pages under a DiagramView, and keep split edges out of its avoid pass"
```

### Task 4: Pages in an effect doc, shown under `nodeGraph`

**Files:**
- Modify: `packages/diagram/src/effect/types.ts` (`EffectDoc`)
- Modify: `packages/diagram/src/effect/editorMapping.ts` (`editorScene`)
- Modify: `packages/diagram/src/effect/EffectEditor.tsx`
- Test: `packages/diagram/src/effect/editorMapping.test.ts`, `packages/diagram/src/effect/EffectEditor.pages.browser.test.tsx`

**Interfaces:**
- Consumes: `DiagramData.pages`, `diagramPages`, `DiagramViewProps.pages`.
- Produces: `EffectDoc.pages?: readonly Page[]`, documented beside `places`. `editorScene` copies it into `data.pages` under `nodeGraph` only. `EffectEditor` passes `pages={{ placed: diagramPages(built.data), fill: (options?.theme ?? LOOK_THEME).page }}` under `nodeGraph` when that list isn't empty.

- [ ] **Step 1: Write the failing tests.**
  - `editorMapping.test.ts`: `it('carries the doc’s pages under nodeGraph only')`: for a doc with `pages: [{ id: 'p1', width: 400, height: 300 }]`, `editorScene(doc).data.pages` equals that list, and `editorScene(doc, 'rack').data.pages` and `'lanes'` are `undefined`.
  - Browser: an `EffectEditor` over two stages placed on two pages and one wire between them draws two off-page tags (find them by `offPageTagOf` in the view's scene via the `DiagramViewApi`, or by pixel at the stub tip if the API exposes no scene). Switch `look` to `rack`: no tags.

- [ ] **Step 2: Run to verify they fail**

Run: `onto do --kind test -- npx vitest run --project=weasel-ui packages/diagram/src/effect/editorMapping.test.ts` and `onto do --kind test -- npx vitest run --project=browser packages/diagram/src/effect/EffectEditor.pages.browser.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement** the field, the copy in `editorScene`, and the prop in `EffectEditor`.

- [ ] **Step 4: Run both again**: Expected PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/diagram/src/effect/types.ts packages/diagram/src/effect/editorMapping.ts packages/diagram/src/effect/EffectEditor.tsx packages/diagram/src/effect/editorMapping.test.ts packages/diagram/src/effect/EffectEditor.pages.browser.test.tsx
git commit -m "show an effect doc's pages under the nodeGraph look"
```

### Task 5: weaselchart's pipeline mode adds and deletes pages

**Files:**
- Create: `apps/chart/src/pipeline/pipelinePages.ts`
- Modify: `apps/chart/src/pipeline/pipelineCommands.ts` (`PIPELINE_MENUS.page`), `apps/chart/src/pipeline/PipelineWorkspace.tsx`
- Modify: `docs/TODO.md` (retire or rewrite the pipeline-pages entry, if one exists), `HANDOFF.md` (the fourth-arc section)
- Test: `apps/chart/src/pipeline/pages.browser.test.tsx`

**Interfaces:**
- Consumes: `EffectDoc.pages`, chart's `CHART_PAGE` size (`apps/chart/src/chartDocument.ts`).
- Produces: `PIPELINE_PAGE_ACTIONS = { add: 'pipeline.page.add', remove: 'pipeline.page.delete' }`; `PIPELINE_PAGE_MENU: MenuRuns`; `usePipelinePageCommands(pipeline: PipelineDoc): void`, registering 'Add Page' (appends `{ id: nextPageId(pages), width, height }` sized like the last page, else `CHART_PAGE`) and 'Delete Page' (drops the last page, enabled only while there is one; stages are not moved or deleted). Each is one undo step named after the command.

- [ ] **Step 1: Write the failing test** in `pages.browser.test.tsx`, in the style of `pipeline.browser.test.tsx`: open pipeline mode, run Page › Add Page twice, expect `doc.pages` to have two entries and the canvas to paint the page fill at the second page's middle; place two wired stages one per page and expect two off-page tags; run Delete Page and expect one page and both stages still in `doc.pipeline.stages`; undo and expect two pages.

- [ ] **Step 2: Run to verify it fails**

Run: `onto do --kind test -- npx vitest run --project=browser apps/chart/src/pipeline/pages.browser.test.tsx`
Expected: FAIL, no Page menu in pipeline mode.

- [ ] **Step 3: Implement** `pipelinePages.ts`, add `page: PIPELINE_PAGE_MENU` to `PIPELINE_MENUS`, and call `usePipelinePageCommands(pipeline)` in `PipelineWorkspace`.

- [ ] **Step 4: Run it again**: Expected PASS.

- [ ] **Step 5: Run the branch on the fleet** (after Task 6 too, if it hasn't landed yet)

Run: `npm run test:fleet -- HEAD`
Expected: exit 0, log has `fleet-tree: N changed path(s) match <sha>` and the gate project passed.

- [ ] **Step 6: Commit**

```bash
git add apps/chart/src/pipeline/pipelinePages.ts apps/chart/src/pipeline/pipelineCommands.ts apps/chart/src/pipeline/PipelineWorkspace.tsx apps/chart/src/pipeline/pages.browser.test.tsx docs/TODO.md HANDOFF.md
git commit -m "add Page › Add Page and Delete Page to weaselchart's pipeline mode"
```

### Task 6: Export answers page membership with the split's rule

**Files:**
- Modify: `packages/core/src/core/pages/pages.ts`, `packages/core/src/barrel/viewport.ts`
- Modify: `packages/diagram-formats/src/fromScene.ts` (`documentFromScene`), `packages/diagram-formats/src/document.ts` (`crossPageEdges` doc comment)
- Create: `.changeset/export-gap-shapes.md` (`@weasel-js/core` and `@weasel-js/diagram-formats`, both `patch`)
- Test: `packages/core/src/core/pages/pages.test.ts`, `packages/diagram-formats/src/fromScene.test.ts`

Independent of Tasks 1–5; it can run first or alongside them.

**Interfaces:**
- Consumes: `offPageSplits` (`@weasel-js/diagram`).
- Produces: `pageHolding(pages: readonly PlacedPage[], bounds: Bounds): PlacedPage | null`, in `pages.ts` and exported beside `pageOfBounds`. It returns `pageOfBounds(pages, bounds)` when that isn't `null`; otherwise the page whose rect is the shortest distance from `bounds` (box-to-box gap, 0 when touching), the earlier on a tie, and `null` only for an empty list.

- [ ] **Step 1: Write the failing tests.**
  - `pages.test.ts`, with the two side-by-side 200×100 pages used elsewhere (p1 x 0..200, p2 x 240..440):

```ts
describe('pageHolding', () => {
  it('is the page a box is on, when it is on one', () => {
    expect(pageHolding(PAGES, { x: 20, y: 20, width: 40, height: 30 })?.id).toBe('p1');
  });
  it('puts a box in the gap on the nearer page', () => {
    expect(pageHolding(PAGES, { x: 230, y: 20, width: 5, height: 30 })?.id).toBe('p2');
    expect(pageHolding(PAGES, { x: 203, y: 20, width: 5, height: 30 })?.id).toBe('p1');
  });
  it('takes the earlier page when a gap box is equally near both', () => {
    expect(pageHolding(PAGES, { x: 215, y: 20, width: 10, height: 30 })?.id).toBe('p1');
  });
  it('is null with no pages', () => {
    expect(pageHolding([], { x: 0, y: 0, width: 1, height: 1 })).toBeNull();
  });
});
```

  - `fromScene.test.ts`, on the file's existing two-page scene fixture:
    - `it('exports a shape in the gap with the page nearest it, not the first')`: a shape just left of p2 lands in p2's `data.nodes`.
    - `it('marks a connector cross-page exactly when the scene splits it')`: an edge from a p1 shape to a p2 shape is in `crossPageEdges`; an edge from a gap shape exported with p2 to a p2 shape is in p2's `data.edges`.
    - `it('keeps a connector from a gap shape to another page whole, with its waypoints')`: a gap shape exported with p1, an edge from it to a p2 shape with waypoints; the edge is in `crossPageEdges` with those waypoints in world coordinates, and `documentSpecs` of the result draws that edge with no `offPage`.

- [ ] **Step 2: Run to verify they fail**

Run: `onto do --kind test -- npx vitest run --project=core packages/core/src/core/pages/pages.test.ts` and `onto do --kind test -- npx vitest run --project=weasel-ui packages/diagram-formats/src/fromScene.test.ts`
Expected: FAIL, `pageHolding is not a function`; the gap shape lands on p1.

- [ ] **Step 3: Implement.** Add `pageHolding` to `pages.ts` and the barrel. In `documentFromScene`, `pageOf` uses `pageHolding(pages, root.pose)!`. Build each edge's end boxes from its ends' world poses and run `offPageSplits({ pages, edges })` once. An edge whose ends export to one page goes in that bucket as now. Every other edge goes in `crossPageEdges`: through `readEdge(node, label, null, theme)` when split (no waypoints, as now), and through `readEdge(node, label, { x: 0, y: 0 }, theme)` when not split, which keeps its waypoints in world coordinates. Rewrite the `crossPageEdges` comment in `document.ts` to say that a split edge carries no waypoints and an unsplit one keeps them in world space, and the `documentFromScene` comment to name the nearest-page rule in place of "the first page".

- [ ] **Step 4: Run both again**: Expected PASS. Then run the format round-trip tests that read `crossPageEdges`: `onto do --kind test -- npx vitest run --project=weasel-ui packages/diagram-formats`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/core/pages/pages.ts packages/core/src/barrel/viewport.ts packages/core/src/core/pages/pages.test.ts packages/diagram-formats/src/fromScene.ts packages/diagram-formats/src/document.ts packages/diagram-formats/src/fromScene.test.ts .changeset/export-gap-shapes.md
git commit -m "export a gap shape to its nearest page, and mark connectors cross-page by the split's rule"
```

When the branch merges, delete this plan, and rewrite the spec's "Pages in `DiagramData`" row as landed or remove it with the rest of the spec once every piece has shipped.
