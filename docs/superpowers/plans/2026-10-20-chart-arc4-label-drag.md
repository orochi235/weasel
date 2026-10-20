# Dragging an edge label: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an edge label be dragged anywhere along and beside its edge, with the spot it was left at
surviving a reroute, and add Format › Connector › Reset label to undo the drag.

**Architecture:** A press on a label is claimed by a hit-only affordance layer over the labels, and a
drag binding sends it to an ongoing `diagram.moveLabel` action. That action inverts `labelCenter`.
The point under the pointer becomes a route fraction and an offset, and it previews and commits
`{ at, offset, dodge: false }` on the label's trait. It is built the way route editing is (`waypointLayer` +
`createRouteEditAction` + `diagramWaypoints`), so chart mode registers it on a live scene and
`DiagramView` reports it through a callback.

**Tech Stack:** TypeScript, React, `@weasel-js/core` affordances/actions, `@weasel-js/geom`, vitest
(`weasel-ui`, `draw` and `browser` projects).

**Spec:** `docs/superpowers/specs/2026-10-20-chart-fourth-arc-design.md`, row "Dragging an edge label".

## Global Constraints

- A drag writes `at` (a route fraction, a number), `offset`, and `dodge: false`, and drops `placed`.
- Format › Connector › Reset label clears all three.
- It works in chart mode and in a `DiagramView` backed by `DiagramData`. Pipeline mode is not in scope (see the end of this plan).
- Every changeset is `patch`.
- No source file over 400 lines, no function over 120 (`npm run check:size`).
- Every test, typecheck and lint runs on the fleet. Use `onto do --kind test -- …` for a scoped run and `npm run test:fleet` for a commit. Never run them on this Mac.
- Diagram and geom unit tests run under `--project=weasel-ui`, chart unit tests under `--project=draw`, and every `*.browser.test.tsx` under `--project=browser`.
- US English in labels and copy. The menu item reads `Reset label`, in sentence case to match `Reset route`.

## Review Focus

- **Dragging across the line** flips the label to the other side, with `offset` changing sign, and the label stays under the pointer instead of jumping. Pinned in Task 2.
- **A click with no movement** commits nothing and adds no history entry. Pinned in Task 3.
- **Escape mid-drag** puts the label back and commits nothing. Pinned in Task 3.
- **A dragged label under `layered` layout** stays where it was dropped. Neither the room layout leaves for labels (`placementOf`'s `labelAt`) nor `labels: 'dodge'` moves it. Pinned in Task 5.
- **A locked label, or a label on a locked edge,** has no drag region, so a press falls through to whatever is under it. Pinned in Task 3.

---

### Task 1: `PathMeasure.nearest`

**Files:**
- Modify: `packages/geom/src/paths/pathMeasure.ts`
- Modify: `packages/geom/src/index.ts` (export the new type)
- Test: `packages/geom/src/paths/pathMeasure.test.ts`

**Interfaces:**
- Produces: `PathMeasure.nearest(p: Point): PathNearestStation`, and
  `export interface PathNearestStation extends PathStation { s: number; dist: number }`. `s` is the arc
  length at the nearest point, on the same scale `at(s)` reads.

- [ ] **Step 1: Write the failing tests** in `pathMeasure.test.ts`, on the existing `elbow`:

```ts
it('finds the arc length nearest a point, the inverse of at()', () => {
  const m = measurePath(elbow)!;
  expect(m.nearest({ x: 30, y: -12 })).toMatchObject({ s: 30, dist: 12, point: { x: 30, y: 0 }, tangent: { x: 1, y: 0 } });
  expect(m.nearest({ x: 140, y: 150 })).toMatchObject({ s: 200, point: { x: 100, y: 100 } });
  const back = m.nearest(m.at(137).point);
  expect(back.s).toBeCloseTo(137, 9);
});

it('answers a zero-length path at its point', () => {
  const m = measurePath(polylineFromPoints([{ x: 5, y: 5 }, { x: 5, y: 5 }]))!;
  expect(m.nearest({ x: 8, y: 9 })).toMatchObject({ s: 0, dist: 5, point: { x: 5, y: 5 } });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `onto do --kind test -- npx vitest run --project=weasel-ui packages/geom/src/paths/pathMeasure.test.ts`
Expected: FAIL, `m.nearest is not a function`.

- [ ] **Step 3: Implement `nearest`** on both returned objects. It projects onto every flattened segment and keeps the
  closest one, with the earliest segment winning a tie, as `nearestOnPath` does. The tangent is the segment's heading.
  Update the `PathMeasure` doc to say `nearest` is `at`'s inverse.

- [ ] **Step 4: Run the tests again and check they pass** (same command).

- [ ] **Step 5: Commit**

```bash
git add packages/geom/src/paths/pathMeasure.ts packages/geom/src/paths/pathMeasure.test.ts packages/geom/src/index.ts
git commit -m "add PathMeasure.nearest, the arc length nearest a point"
```

### Task 2: `labelSpotAt`, the inverse of `labelCenter`

**Files:**
- Modify: `packages/diagram/src/labels/station.ts`
- Test: `packages/diagram/src/labels/station.test.ts` (create)

**Interfaces:**
- Consumes: `measurePath(path).nearest` (Task 1), and `subpathOf` (`../subpaths`).
- Produces: `labelSpotAt(whole: Path, center: Vec2, size: { width: number; height: number }): LabelSpot | null`.
  It returns where a label of `size` whose center is at `center` sits, as a fraction of the first subpath's length
  and an offset. It returns `null` for a path with no points.

- [ ] **Step 1: Write the failing tests**, on a straight route `(0,0)→(200,0)` and an elbow `(0,0)→(100,0)→(100,100)` built with `polylineFromPoints`. The label size is `{ width: 40, height: 12 }`:

```ts
it.each([
  [0.5, 9], [0.5, -9], [0.25, 0], [0.8, 30], [0.1, -22],
])('round-trips labelCenter at %s, offset %s', (at, offset) => {
  for (const path of [straight, elbow]) {
    const center = labelCenter(path, { at, offset }, SIZE)!;
    const spot = labelSpotAt(path, center, SIZE)!;
    expect(spot.at).toBeCloseTo(at, 6);
    expect(spot.offset).toBeCloseTo(offset, 6);
  }
});

it('puts a center dragged below a rightward edge on its right, offset negative', () => {
  expect(labelSpotAt(straight, { x: 100, y: 40 }, SIZE)).toEqual({ at: 0.5, offset: -34 });
});

it('centers a label on the line when its center is within half its depth', () => {
  expect(labelSpotAt(straight, { x: 50, y: 3 }, SIZE)).toEqual({ at: 0.25, offset: 0 });
});

it('clamps a center past the end to the end', () => {
  expect(labelSpotAt(straight, { x: 260, y: -6 }, SIZE)!.at).toBe(1);
});
```

On a rightward edge the normal is `(0, -1)` and half the depth is 6, so a center at `y = 40` is 40 below the line, and the label's near side is `40 - 6 = 34` below it.

- [ ] **Step 2: Run them and watch them fail**

Run: `onto do --kind test -- npx vitest run --project=weasel-ui packages/diagram/src/labels/station.test.ts`
Expected: FAIL, `labelSpotAt` is not exported.

- [ ] **Step 3: Implement `labelSpotAt`** in `station.ts`. It measures `subpathOf(whole, 0) ?? whole`, the same subpath `labelCenter` stands on, using the same default tolerance as `pointAlongPath`. It takes `nearest(center)`, sets `at = s / length` (0.5 when the length is 0), and lets `d` be the signed distance along the normal `(tangent.y, -tangent.x)`. Half the depth is `(|nx|·width + |ny|·height) / 2`. The offset is `sign(d) · max(|d| − half, 0)`, and an exact zero is written as `0`, not `-0`.

- [ ] **Step 4: Run the tests again and check they pass** (same command).

- [ ] **Step 5: Commit**

```bash
git add packages/diagram/src/labels/station.ts packages/diagram/src/labels/station.test.ts
git commit -m "add labelSpotAt, the route fraction and offset a label's center stands at"
```

### Task 3: The label layer and the `diagram.moveLabel` drag

**Files:**
- Create: `packages/diagram/src/labelDragLayer.ts`: the draggable labels, the hit-only layer, and the press scratch
- Create: `packages/diagram/src/labelDragAction.ts`: the action, its default commit, and `movedLabelData`
- Modify: `packages/diagram/src/edgeLabel.ts`: `edgeUnder` also finds the edge of a label under the point
- Modify: `packages/diagram/src/contribution.ts`: add `diagramLabelDrag`
- Modify: `packages/diagram/src/index.ts`
- Test: `packages/diagram/src/labelDragAction.test.ts` (create; jsdom, a real `createScene` built the way `waypoint.scene.test.ts` builds one)

**Interfaces:**
- Consumes: `labelSpotAt`, `labelCenter` (`./labels/station`), `diagramLabelOf`, `LABEL_PLACEMENT`, plus
  `documentDepOf`, `documentPose`, `effectivePose`, `translatePoseViaDescriptor`, `AUTO_POSE_DESCRIPTOR` and
  `composeAffordanceLayer` from `@weasel-js/core`.
- Produces, in `labelDragLayer.ts`:
  - `LABEL_DRAG_LAYER_ID = 'diagram-edge-labels'` and `LABEL_DRAG_AFFORDANCE_KIND = 'layer:diagram-edge-labels'`.
  - `interface LabelScratch { targetId: string; labelId: string; edgeId: string }` and `labelScratchOf(hit: { payload?: unknown } | null | undefined): LabelScratch | null`.
  - `draggableLabels(scene: Scene<unknown, string, unknown>): Iterable<{ labelId: string; edgeId: string; box: Bounds; path: Path }>`. It yields every node with a label trait, exactly one `dependsOn`, neither it nor its edge locked, and an edge that derives a path, with `box` taken from `documentPose`.
  - `labelUnder(scene, at: Vec2): LabelScratch | null`, the topmost label whose box holds `at`.
  - `labelDragLayer(scene, opts?: { cursor?: CursorSpec }): RenderLayer<unknown>`. It makes one `rect` region per draggable label, with `targetId: null`, no paint, `strength: 'exclusive'`, `claimedKinds: ['pointer']`, and cursor `'move'` by default.
- Produces, in `labelDragAction.ts`:
  - `MOVE_LABEL_ACTION_ID = 'diagram.moveLabel'`.
  - `interface LabelEdit { labelId: string; edgeId: string; placement: DiagramLabel | null }`, where `null` means reset.
  - `movedLabelData(data: unknown, spot: LabelSpot): Record<string, unknown>`. It sets `diagram.label` to `{ at: spot.at, offset: spot.offset, dodge: false }`, dropping `placed`.
  - `commitLabelToScene(edit: LabelEdit, ctx: InvocationCtx): void`. It runs one `scene.batch`, labeled `'Move label'`, or `'Reset label'` when `placement` is `null`, which writes `LABEL_PLACEMENT`.
  - `interface LabelDragOptions { commit?: (edit: LabelEdit, ctx: InvocationCtx) => void; id?: string }` and `createLabelDragAction(opts?: LabelDragOptions): Action`.
- Produces, in `contribution.ts`: `GRAB_LABEL_ACTION_ID = 'diagram.grabLabel'`, `SELECT_LABEL_EDGE_ACTION_ID = 'diagram.selectLabelEdge'`, and
  `diagramLabelDrag(opts: LabelDragOptions & { scene: Scene<unknown, string, unknown>; selected: () => readonly string[]; cursor?: CursorSpec }): { layer: RenderLayer<unknown>; contribution: Contribution }`.
  The contribution has id `'weasel-diagram-label-drag'` and eligibility `{ claimed: true }`. It holds the drag, Reset label (Task 4), the grab no-op on `pointerDown`, a select-edge action on `click`, and a `doubleClick` binding to `EDIT_EDGE_LABEL_ACTION_ID`, all targeting `affordance:${LABEL_DRAG_AFFORDANCE_KIND}`.

The action keeps its state split by when it changes. What it captured at the press is read-only: `labelId`, `edgeId`, the label's `data`, its effective pose and size, the edge's path, the grab offset (the label's center minus the press point), and `deps`. The spot it proposes is replaced on every move. `previewIds` is `[labelId]`. `previewData` is `movedLabelData(data, spot)`. `previewPose` is the press pose moved by the world delta between the press center and `labelCenter(path, nextLabel, size)`: preview resolution uses `effectivePose` for a node with no `previewPose`, and that pose comes from the committed data. The spot is `null` until the pointer moves, so a still click commits nothing. Eligible modes are `normal` and `isolation`, as for `editEdgeLabelAction`.

- [ ] **Step 1: Write the failing tests.** The scene has two boxes, a straight edge `ab` from `(100, 20)` to `(300, 20)` (`EDGE_DERIVE_PATH`), and `edgeLabelSpec('ab', 'Yes', { layer: 'main' })`. The tests drive the handle the way `waypointAction.test.ts` does: `start(ctx with drag.affordance = { kind: LABEL_DRAG_AFFORDANCE_KIND, payload })`, then `onMove`, then `onEnd`.
  - `'previews the label under the pointer and commits at, offset and dodge: false'`: press on the label's center, move 40 down, and end with `'commit'`. The label's `diagram.label` equals `{ ...labelSpotAt(path, pressCenter + (0, 40), size), dodge: false }`, computed in the test rather than hardcoded, and has no `placed`. Mid-drag, `previewPose('ab/label')` is centered on `labelCenter` of the previewed data.
  - `'is one history entry, undone in one'`: after the commit, `scene.history.undo()` restores the original trait.
  - `'commits nothing on a click with no movement'`: start, then end with `'commit'` at the press point. The data is unchanged, and the history depth is unchanged.
  - `'commits nothing when canceled'`: move, then end with `'cancel'`. The data is unchanged.
  - `'keeps its fraction when the edge is rerouted'`: after the commit, move box `b` to `(300, 120)`. The label's derived center equals `labelCenter(newPath, label, size)`, and its `at` still reads 0.5.
  - `'offers no region for a locked label or a label on a locked edge'`: `labelUnder` returns `null` for both, and it returns the scratch once both are unlocked.
  - `'edits the text on a double-click on the label'`: `editEdgeLabelAction`'s `enabled(deps, labelCenter)` is `true` when `nodeAtPoint` returns nothing.

- [ ] **Step 2: Run them and watch them fail**

Run: `onto do --kind test -- npx vitest run --project=weasel-ui packages/diagram/src/labelDragAction.test.ts`
Expected: FAIL, the modules don't exist.

- [ ] **Step 3: Implement `labelDragLayer.ts`** from the Interfaces block above.
- [ ] **Step 4: Implement `labelDragAction.ts`** from the Interfaces block above.
- [ ] **Step 5: Make `edgeUnder` in `edgeLabel.ts` fall back to `labelUnder(deps.scene, at)?.edgeId`**, so the double-click on a label that the label layer now claims still opens its text.
- [ ] **Step 6: Add `diagramLabelDrag` to `contribution.ts`**, with a doc comment in the form `diagramWaypoints` uses. It says which layer to register it under: before the port layer, so a port or a route handle wins over a label.
- [ ] **Step 7: Export the new names from `index.ts`**, beside the `./edgeLabel` exports.
- [ ] **Step 8: Run the tests again and check they pass** (same command), then `onto do --kind typecheck -- npm run typecheck`.
- [ ] **Step 9: Commit**

```bash
git add packages/diagram/src/labelDragLayer.ts packages/diagram/src/labelDragAction.ts packages/diagram/src/labelDragAction.test.ts packages/diagram/src/edgeLabel.ts packages/diagram/src/contribution.ts packages/diagram/src/index.ts
git commit -m "drag an edge label along and beside its edge"
```

### Task 4: Reset label

**Files:**
- Create: `packages/diagram/src/labelCommands.ts`
- Modify: `packages/diagram/src/contribution.ts` (add the action to `diagramLabelDrag`)
- Modify: `packages/diagram/src/index.ts`
- Test: `packages/diagram/src/labelCommands.test.ts` (create)

**Interfaces:**
- Consumes: `LabelEdit`, `commitLabelToScene` (Task 3).
- Produces: `RESET_LABEL_ACTION_ID = 'diagram.resetLabel'`, and
  `createResetLabelAction(opts: { selected: () => readonly string[]; commit?: (edit: LabelEdit, ctx: InvocationCtx) => void }): Action`.
  It is labeled `'Reset label'`, in group `'diagram'`, and requires `['scene']`. It is enabled only when a selected edge has a label with `dodge === false`. It commits `placement: null` for each such label, in one `scene.batch('Reset label')` when it commits to the scene.

- [ ] **Step 1: Write the failing tests**, on the scene from Task 3 after a committed drag:
  - `'puts a dragged label back at LABEL_PLACEMENT, in one history entry'`
  - `'is disabled with no edge selected, and for an edge whose label was never dragged'`, which returns `ActionDisabledReason.NotApplicable`
  - `'reports placement null through commit'`, with a `vi.fn()` commit
- [ ] **Step 2: Run them and watch them fail**

Run: `onto do --kind test -- npx vitest run --project=weasel-ui packages/diagram/src/labelCommands.test.ts`
Expected: FAIL, the module doesn't exist.

- [ ] **Step 3: Implement `labelCommands.ts`** the way `createResetRouteAction` is built, and add the action to `diagramLabelDrag`'s `actions`.
- [ ] **Step 4: Run the tests again and check they pass** (same command).
- [ ] **Step 5: Commit**

```bash
git add packages/diagram/src/labelCommands.ts packages/diagram/src/labelCommands.test.ts packages/diagram/src/contribution.ts packages/diagram/src/index.ts
git commit -m "add the Reset label command"
```

### Task 5: `DiagramView`'s `onMoveLabel`

**Files:**
- Modify: `packages/diagram/src/diagramViewProps.ts`: the `LabelMove` type and the `onMoveLabel` prop
- Modify: `packages/diagram/src/diagramEditing.ts`: build `diagramLabelDrag` when `onMoveLabel` is set
- Modify: `packages/diagram/src/DiagramView.tsx`: pass the prop through, and include it in `pickEdges`' default
- Modify: `packages/diagram/src/index.ts` (export `LabelMove`)
- Test: `packages/diagram/src/DiagramView.labelDrag.browser.test.tsx` (create; copy `waypoints.browser.test.tsx`'s mount and `pointer` helpers)
- Test: `packages/diagram/src/fromData.test.ts` (add one case)

**Interfaces:**
- Consumes: `diagramLabelDrag`, `LabelEdit` (Tasks 3–4).
- Produces: `interface LabelMove { edge: string; placement: DiagramLabel | null }` and
  `onMoveLabel?: (change: LabelMove) => void`. The prop's doc says: "Set to let an edge's label be dragged
  along and beside it, and to enable Reset label for the selected edge. Reports the placement and draws
  nothing; store it as the data edge's `labelPlacement`, and delete that field for `null`." `edge` is `edgeIdOf` of the data edge.

The label layer goes into `layers` after `regions` and before `portsLayer`.

- [ ] **Step 1: Write the failing browser test.** Mount `a → b` as `layout: 'none'`, with `label: 'Yes'` on the edge. Press on the label's center, move 40 px down in 8 steps, and release. `onMoveLabel` is called once, with `{ edge: AB, placement: { at: ~0.5, offset: < 0, dodge: false } }`. It is not called for a press and release at the same point, and `onSelect` reports `AB` for that click.
- [ ] **Step 2: Write the failing data test** in `fromData.test.ts`: `'keeps a dragged label where it was left under layered layout and dodging'`. Build `diagramScene` with `layout: 'layered'` and `labels: 'dodge'` where those apply. A labeled edge has `labelPlacement: { at: 0.3, offset: 12, dodge: false }`, and a third node sits over that spot. The label spec's `data.diagram.label` keeps `at: 0.3` (not `{ near }`), and the spec carries no `placed`.
- [ ] **Step 3: Run both and watch them fail**

Run: `onto do --kind test -- npx vitest run --project=browser packages/diagram/src/DiagramView.labelDrag.browser.test.tsx`
and `onto do --kind test -- npx vitest run --project=weasel-ui packages/diagram/src/fromData.test.ts`
Expected: the browser test fails (no callback). The data test may already pass. If it does, keep it as a guard and say so in the commit body.

- [ ] **Step 4: Add the prop, the wiring and the pass-through**, using `report.current.onMoveLabel?.({ edge: edgeId, placement })` as the commit.
- [ ] **Step 5: Run both again and check they pass** (same commands).
- [ ] **Step 6: Commit**

```bash
git add packages/diagram/src/diagramViewProps.ts packages/diagram/src/diagramEditing.ts packages/diagram/src/DiagramView.tsx packages/diagram/src/index.ts packages/diagram/src/DiagramView.labelDrag.browser.test.tsx packages/diagram/src/fromData.test.ts
git commit -m "report a dragged edge label from DiagramView through onMoveLabel"
```

### Task 6: Chart mode, the changeset, and the TODO entry

**Files:**
- Modify: `apps/chart/src/useChartDiagram.tsx`: build `diagramLabelDrag({ scene, selected })`, put its layer after `containers.layer` and its contribution in `ambient`, and add it to the doc comment
- Modify: `apps/chart/src/chartCommands.ts`: add `label: run({ resetLabel: RESET_LABEL_ACTION_ID })` to the `Connector` group, and mention Reset label in `CHART_MENUS`' doc
- Test: `apps/chart/src/labelDrag.browser.test.tsx` (create; seed the way `hops.browser.test.tsx` does, and take `drag`/`click` from `chart.browser.test.tsx`'s shape. Don't factor them out: the TODO entry on shared pointer helpers covers that)
- Create: `.changeset/edge-label-drag.md`
- Modify: `docs/TODO.md`

- [ ] **Step 1: Write the failing browser test** `'drags a connector label, keeps it on a reroute, and resets it'`. Seed boxes `a` at (200, 300) and `b` at (600, 300), a straight connector `ab`, and `edgeLabelSpec('ab', 'Yes', { layer: 'shapes' })`. Then, in order:
  1. The connector runs along y = 330. Drag from the label's center (its node's `effectivePose` center, mapped with `at(host, …)`) down to `at(host, 450, 370)`. The saved label (`CHART_SCENE_KEY`) has `dodge: false`, `at` close to 0.5, and `offset < 0`.
  2. Click the label. The connector is selected, because its route handles are inked.
  3. Use Format › Connector › Reset label. The saved label equals `LABEL_PLACEMENT`, with no `dodge`.
  4. Press Mod+Z. The dragged placement is back.
- [ ] **Step 2: Run it and watch it fail**

Run: `onto do --kind test -- npx vitest run --project=browser apps/chart/src/labelDrag.browser.test.tsx`
Expected: FAIL, because the drag pans or marquees instead of moving the label.

- [ ] **Step 3: Wire `useChartDiagram.tsx` and `chartCommands.ts`.**
- [ ] **Step 4: Run it again and check it passes** (same command).
- [ ] **Step 5: Write `.changeset/edge-label-drag.md`**, with `"@weasel-js/geom": patch` and `"@weasel-js/diagram": patch`. In prose it says: an edge label can be dragged (`diagramLabelDrag`, `DiagramView`'s `onMoveLabel`), the drag stores a route fraction, an offset and `dodge: false`, `diagram.resetLabel` clears it, and `PathMeasure.nearest` is added. All of it is additive.
- [ ] **Step 6: Edit `docs/TODO.md`'s fourth-arc entry** to drop "dragging an edge label". Do it as a rewrite of whatever that entry says at merge time, since other pieces of the arc edit the same line.
- [ ] **Step 7: Commit, then run the fleet**

```bash
git add apps/chart/src/useChartDiagram.tsx apps/chart/src/chartCommands.ts apps/chart/src/labelDrag.browser.test.tsx .changeset/edge-label-drag.md docs/TODO.md
git commit -m "drag connector labels in weaselchart, and add Format › Connector › Reset label"
npm run test:fleet
```

Expected: the log shows `fleet-tree: N changed path(s) match <sha>`, the gate test passed rather than skipped, and every selected test passes. Merge to `main` only when that holds.

---

**Left out, and why:** pipeline mode. Its wires do carry labels (`effect/draw.ts`, a wire's `label` or a decision's branch name), but `EffectWire` has nowhere to store a placement, and the `lanes` look rewrites each label's `labelPlacement` on every build (`effect/lanesRoutes.ts`). Wiring `onMoveLabel` through `EffectEditor` needs a wire field and a rule for which of the two wins. The spec names chart mode and `DiagramView` only.
