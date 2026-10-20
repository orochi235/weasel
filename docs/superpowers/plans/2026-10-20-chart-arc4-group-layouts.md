# Groups under `rack` and `lanes` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Under the `rack` and `lanes` looks, a group's box holds only its members. A group can be renamed by double-clicking its title, and dragging the title moves the whole group along the main line.

**Architecture:** The `chain` layout (the one `rack` uses) and the `lanes` look's own column placement both treat a group as a block: its members get columns no other stage shares, and the gaps beside a block leave room for its box. Moving a group rewires the pipeline, the way a stage drag does now (`moveInChain`), generalized to a run of stages. The title drag is a third reorder in `editorReorders`, built on the existing `diagram.reorder` action. Rename under these looks is a double-click action over the title grip, opening the existing `GroupTitleField` overlay.

**Tech Stack:** TypeScript, React, vitest (`weasel-ui` project for jsdom units, `browser` project for pointer tests), `@weasel-js/diagram`, `@weasel-js/core` actions/bindings.

**Spec:** `docs/superpowers/specs/2026-10-20-chart-fourth-arc-design.md` (the "Groups under `rack` and `lanes`" row and the "Groups" decision).

## Global Constraints

- Group boxes size to fit their members. No resize handles under `rack` or `lanes`.
- Rename works in both looks. Dragging a group's title reorders the group as a unit.
- Every changeset is `patch`.
- No source file over 400 lines and no function over 120 lines (`npm run check:size`).
- Every test, typecheck and lint runs on the fleet, never on this Mac:
  `onto do --kind test --node <node> --ref <branch> -- npx vitest run --project=<p> <path>`.
  Unit tests under `packages/diagram` are project `weasel-ui`, and `*.browser.test.tsx` files are project `browser`.
- Pointer behavior is proved by a `*.browser.test.tsx` file. jsdom can't prove it.
- A tool or drag is a binding to an action (`docs/taxonomy.md`). No hand-rolled pointer handlers.

## Review Focus

- **A group whose line members a non-member splits** (made under `nodeGraph`, then viewed under `rack`). The line order is the signal order, so layout can't close the gap. The box still covers the stage in between, the title is not draggable, and nothing throws. Pinned by a test in Task 4.
- **A group with no stage on the main line.** It still draws as a block in `lanes` and hangs together in `rack`, but it has no place in the order, so its title can't be dragged. Pinned in Task 5.
- **An unlabeled group.** It has no title node, so its grip is the top band of its box, and rename opens over the box. Pinned in Task 6.
- **Nested groups.** The press picks the innermost group whose grip holds it, and that group moves among its parent's direct members only. Pinned in Task 5.
- **A stage dragged into the middle of another group's run, or a member dragged out of its own group's run.** Refused, so the drag can't break a contiguous group. Pinned in Task 4.

---

### Task 1: Reorder items that can't be picked up, and bar drags that carry

**Files:**
- Modify: `packages/diagram/src/reorder.ts`
- Test: `packages/diagram/src/reorder.test.ts`

**Interfaces:**
- Produces: `ReorderItem.grip?: Box | null`, where `null` means the item is never picked up but still has gaps either side. In `show: 'bar'` mode, `previewIds` and `previewPose` move every id in `item.carries` (default `[item.id]`) by the drag offset.

- [ ] **Step 1: Write the failing tests**

```ts
it('never picks up an item whose grip is null, but still gaps around it', () => {
  const slots = sequenceSlots('x', [
    { id: 'a', bounds: { x: 0, y: 0, width: 10, height: 10 }, grip: null },
    { id: 'b', bounds: { x: 20, y: 0, width: 10, height: 10 } },
  ]);
  const action = createReorderAction({ slots: () => slots, commit: () => {} });
  expect(action.enabled!({} as never, { x: 5, y: 5 })).toBe(ActionDisabledReason.NotApplicable);
  expect(action.enabled!({} as never, { x: 25, y: 5 })).toBe(true);
  expect(slots.gaps.map((g) => g.index)).toEqual([0, 1, 2]);
});

it('carries every id in carries under a bar drag', () => {
  // start a bar drag on item 'g' with carries ['g', 'm1', 'm2'], move by 30 along x
  expect(handle.previewIds!()).toEqual(['g', 'm1', 'm2']);
  expect(handle.previewPose!('m1')).toMatchObject({ x: poseOf('m1').x + 30 });
});
```

- [ ] **Step 2: Run them on the fleet and watch them fail**

Run: `onto do --kind test --node teitou --ref <branch> -- npx vitest run --project=weasel-ui packages/diagram/src/reorder.test.ts`
Expected: FAIL. `grip: null` is a type error, and `previewIds` returns `['g']`.

- [ ] **Step 3: Implement it.** `pickAt` skips an item whose `grip` is `null`. The bar branch reads the scene pose of each carried id at start, and `previewOpaqueIds` returns the same list.

- [ ] **Step 4: Run the tests on the fleet.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/diagram/src/reorder.ts packages/diagram/src/reorder.test.ts
git commit -m "let a reorder item refuse pickup, and carry a bar drag's carried nodes"
```

### Task 2: The `chain` layout keeps each group together

**Files:**
- Create: `packages/diagram/src/chainGroups.ts`
- Modify: `packages/diagram/src/chain.ts` (its header comment says "Groups are ignored", which this task makes false), and `packages/diagram/src/dataTypes.ts` (the `DiagramData.groups` doc: `chain` now keeps groups together, and only `'none'` ignores them)
- Test: `packages/diagram/src/chain.groups.test.ts`

**Interfaces:**
- Consumes: `Hanging` (`{ owner, level }`) from `chainRoutes.ts`, and `graph.groups` (`GraphGroup` with `members` through nesting, `inset`, `minWidth`, `parent`).
- Produces:
  - `groupHanging(graph: Graph, line: readonly GraphNode[], hanging: Hanging): Hanging`. A hung member's owner becomes the line member of its own group that is nearest along the line to its first owner. A group with no line member hangs every member on the owner most of them had (ties go to the earliest on the line). A non-member hung in a column a group holds is moved out past the group's deepest member level, keeping its order.
  - `lineGaps(graph: Graph, line: readonly GraphNode[], rankGap: number, axes: LayoutAxes): number[]`. One gap per neighboring pair of line nodes: `rankGap` plus the rank-side insets of every group that ends at the left node or starts at the right one, nested insets flush at that boundary included (the same sum `cluster.ts`'s `rankGaps` makes). A gap is also widened so each group's run of columns spans at least its `minWidth`.
  - `chainPlan` uses both of these. `slotsFor` takes the gap list in place of the single `rankGap`.

- [ ] **Step 1: Write the failing tests** (build graphs with `groupFixture.graphOf`, which seeds 100×40 nodes)

```ts
const IDS = ['src', 'a', 'b', 'c', 'out', 'sa', 'sc'] as const;
const EDGES = [['src','a'],['a','b'],['b','c'],['c','out'],['sa','a'],['sc','c']] as const;
const OPTS = { direction: 'right', chain: ['src','a','b','c','out'] } as const;

it('hangs a member on a line member of its own group', () => {
  // group g = ['b', 'sc']: sc hangs off c by BFS, but c is outside g
  const r = chain(graphOf(IDS, EDGES, { g: ['b', 'sc'] }), OPTS);
  expect(at(r, 'sc').x).toBe(at(r, 'b').x);
});

it('moves an outsider past the members hung in a group column', () => {
  // group g = ['a'] plus a member hung one step out; sa is an outsider in a's column
  const r = chain(graphOf([...IDS, 'ma'], [...EDGES, ['ma','a']], { g: ['a', 'ma'] }), OPTS);
  expect(at(r, 'sa').y).toBeGreaterThan(at(r, 'ma').y + 40);
});

it('leaves room beside a group for its box', () => {
  const plain = chain(graphOf(IDS, EDGES, {}), OPTS);
  const grouped = chain(graphOf(IDS, EDGES, { g: ['b'] }, 12), OPTS);
  const gap = (r: LayoutResult, l: string, rt: string) => at(r, rt).x - at(r, l).x;
  expect(gap(grouped, 'a', 'b')).toBe(gap(plain, 'a', 'b') + 12);
  expect(gap(grouped, 'b', 'c')).toBe(gap(plain, 'b', 'c') + 12);
});

it('draws no outsider inside a group box under rack', () => {
  // rack(P) with a group of contiguous line stages and side inputs; diagramScene it;
  // for every stage not in the group, its pose does not intersect the group's pose.
});
```

- [ ] **Step 2: Run them on the fleet and watch them fail.** `--project=weasel-ui packages/diagram/src/chain.groups.test.ts`. Expected: FAIL on owner, level and gap.

- [ ] **Step 3: Implement `groupHanging` and `lineGaps` in `chainGroups.ts`, and call them from `chainPlan`.** `tracksNeeded` and `sideRoutes` read the adjusted `Hanging`, so side tracks follow the moved levels.

- [ ] **Step 4: Run `chain.test.ts`, `chain.groups.test.ts`, `effect/rack.test.ts` and `effect/rack.crossing.test.ts` on the fleet.** Expected: PASS. The existing tests have no groups and must not move.

- [ ] **Step 5: Commit**

```bash
git add packages/diagram/src/chainGroups.ts packages/diagram/src/chain.ts packages/diagram/src/chain.groups.test.ts packages/diagram/src/dataTypes.ts
git commit -m "keep each group's members together in the chain layout"
```

### Task 3: `lanes` gives each group columns of its own

**Files:**
- Create: `packages/diagram/src/effect/laneColumns.ts` (`columnsOf` moves here from `lanes.ts`)
- Modify: `packages/diagram/src/effect/lanes.ts`
- Test: `packages/diagram/src/effect/lanes.groups.test.ts`

**Interfaces:**
- Produces:
  - `interface LaneBlock { group: string; first: number; last: number; depth: number; minWidth: number }`. `depth` counts the groups the block sits inside, and `minWidth` is the title's width plus twice `DEFAULT_GROUP_INSET`.
  - `laneColumns(stages: readonly EffectStage[], wires: readonly DrawableWire[], spans: ReadonlyMap<string, Span>, groups: readonly EffectGroup[]): { column: Map<string, number>; blocks: LaneBlock[] }`. Each top-level group is placed as one super-stage, its lanes being the union of its members' spans. Inside the block, the members are laid out by the same rule, recursively for nested groups. No column a block holds has a non-member in it.
- `place()` widens the gap at each block edge by `DEFAULT_GROUP_INSET` per nesting level flush at that edge, and widens a block narrower than its `minWidth`, centering its columns. Group titles are measured in the same `sizesOf` batch as the lane labels.

- [ ] **Step 1: Write the failing tests**

```ts
it('puts no outsider in a column a group holds', () => {
  // P from lanes.test.ts, with groups [{ id: 'g', label: 'Soften', members: ['blur', 'osc'] }]
  const { drawn, box } = built(withGroup);
  const g = box('g');
  for (const n of drawn.data.nodes.filter((n) => !['blur','osc','g'].includes(n.id) && laneTypeOf(n.id) === undefined)) {
    const b = box(n.id);
    expect(b.x + b.width <= g.x || b.x >= g.x + g.width).toBe(true);
  }
});

it('keeps a group box clear of its neighbors', () => {
  // the gap from g's box to the nearest stage either side is at least rankGap (40)
});

it('widens a group to fit a long title', () => {
  // label 'A very long group title indeed': box('g').width >= its label pose width + 2 * DEFAULT_GROUP_INSET
});
```

- [ ] **Step 2: Run them on the fleet and watch them fail.** `--project=weasel-ui packages/diagram/src/effect/lanes.groups.test.ts`

- [ ] **Step 3: Implement `laneColumns`, and change `place()` and the lanes look to use it.**

- [ ] **Step 4: Run `lanes.test.ts`, `lanes.routes.test.ts` and `lanes.groups.test.ts` on the fleet.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/diagram/src/effect/laneColumns.ts packages/diagram/src/effect/lanes.ts packages/diagram/src/effect/lanes.groups.test.ts
git commit -m "give each group columns of its own under the lanes look"
```

### Task 4: Moving a run of stages, and keeping groups contiguous

**Files:**
- Modify: `packages/diagram/src/effect/chainEdit.ts`, `packages/diagram/src/effect/editorReorder.ts`
- Create: `packages/diagram/src/effect/groupOrder.ts`
- Test: `packages/diagram/src/effect/chainEdit.test.ts`, `packages/diagram/src/effect/groupOrder.test.ts`

**Interfaces:**
- Produces:
  - `moveRunInChain(doc: EffectDoc, first: string, last: string, to: number): EffectDoc | null` in `chainEdit.ts`. It moves `chain[i..j]` as one, keeping the wires inside the run. It returns `null` under the same rules as `moveInChain`, and also for a `to` inside `[i + 1, j]`. `moveInChain(doc, s, to)` becomes `moveRunInChain(doc, s, s, to)`. `canMoveInChain` is unchanged.
  - `groupRuns(pipeline: EffectPipeline, chain: readonly string[]): Map<string, { first: number; last: number } | null>` in `groupOrder.ts`. For each group: the chain indices its members span, counted through nested groups. `null` where a non-member sits between them, and absent where the group has no stage on the chain.
  - `stageMove` returns `null` when the move would turn a group that `groupRuns` gives a run into one it gives `null`.

- [ ] **Step 1: Write the failing tests**

```ts
// chainEdit.test.ts, on the src→a→b→c→out fixture
it('moves a run of stages as one', () => {
  const next = moveRunInChain(DOC, 'a', 'b', 4)!;
  expect(mainChain(next.pipeline)).toEqual(['src', 'c', 'a', 'b', 'out']);
  expect(next.pipeline.wires.some((w) => w.from.stage === 'a' && w.to.stage === 'b')).toBe(true);
});
it('refuses a gap inside the run', () => expect(moveRunInChain(DOC, 'a', 'c', 2)).toBeNull());

// groupOrder.test.ts
it('gives a split group no run', () => {
  expect(groupRuns(withGroups([{ id: 'g', members: ['a', 'c'] }]), CHAIN).get('g')).toBeNull();
});
it('refuses a stage drop that splits a group', () => {
  // group g = ['a', 'b']; dropping 'c' into gap 2 (between a and b) gives null
  expect(stageMove(doc, order, { id: 'c', from: 3, to: 2, order: [] })).toBeNull();
});
it('still allows a drop when the group was already split', () => {
  // group g = ['a', 'c']: moving 'out'-adjacent stages elsewhere isn't refused on g's account
});
it('draws a split group around the stage between its members under rack without throwing', () => {
  // editorScene(splitDoc, 'rack') then diagramScene: g's pose contains b's pose
});
```

- [ ] **Step 2: Run them on the fleet and watch them fail.**

- [ ] **Step 3: Implement `moveRunInChain` and `groupRuns`, and add the guard to `stageMove`.**

- [ ] **Step 4: Run `chainEdit.test.ts`, `groupOrder.test.ts`, `EffectEditor.reorder.test.tsx` on the fleet.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/diagram/src/effect/chainEdit.ts packages/diagram/src/effect/chainEdit.test.ts packages/diagram/src/effect/groupOrder.ts packages/diagram/src/effect/groupOrder.test.ts packages/diagram/src/effect/editorReorder.ts
git commit -m "move a run of stages along the chain, and refuse a drop that splits a group"
```

### Task 5: Dragging a group's title reorders it

**Files:**
- Modify: `packages/diagram/src/effect/groupOrder.ts`, `packages/diagram/src/effect/editorReorder.ts`
- Test: `packages/diagram/src/effect/groupOrder.test.ts`, `packages/diagram/src/effect/EffectEditor.groupOrder.browser.test.tsx`

**Interfaces:**
- Consumes: `ReorderItem.grip: null` and bar carries (Task 1), `groupRuns` and `moveRunInChain` (Task 4), `ReorderSource` (`editorReorder.ts`).
- Produces:
  - `groupGripOf(doc: EffectDoc, group: string, boxOf: ReorderSource['boxOf']): Box | undefined`. The band across the group's box from its top edge to the top of its highest member: the title row, or the top padding where there is no title.
  - `groupSlotsAt(source: ReorderSource, at: Vec2): ReorderSlots | null`. Pick the innermost group whose grip holds `at` and whose run is not `null`. Its siblings are the direct members of its parent, or the top level, that have stages on the drawn order (`source.order`). Each sibling group is an item with its grip, its box as `bounds`, and `carries` of the group, every stage and group inside it, and its label node. Each sibling stage is an item with `grip: null`.
  - `groupMove(doc: EffectDoc, order: LookOrder, units: readonly string[], move: ReorderMove): EffectDoc | null`. The gap is read as "before that drawn unit's first stage", as `stageMove` reads it, then `moveRunInChain`.
  - `REORDER_GROUPS_ACTION_ID = 'diagram.reorderGroups'`, a third `reorderContribution` in `editorReorders` labeled 'Reorder group'. `canDrop` and `commit` go through `groupMove`, and the commit reports 'Reorder group'.

- [ ] **Step 1: Write the failing tests**

```ts
// groupOrder.test.ts
it('picks the innermost group whose title holds the press', () => { /* outer ⊃ inner: press in inner's grip → items are outer's direct members */ });
it('has no slots on a group with no stage on the line', () => { /* group of side stages only → null */ });

// EffectEditor.groupOrder.browser.test.tsx, rack and lanes each:
// src → a → b → c → out with group g = ['a', 'b'], label 'Pair'
it.each(['rack', 'lanes'] as const)('drags a group by its title past the next stage under %s', async (look) => {
  // press at the center of g's label pose, drag past c's far edge, release
  expect(changes).toHaveLength(1);
  expect(changes[0]![1]).toBe('Reorder group');
  expect(mainChain(changes[0]![0].pipeline)).toEqual(['src', 'c', 'a', 'b', 'out']);
});
it('leaves a stage drag on a member as a stage drag', async () => {
  // press on a's body under rack, drop before src: refused, since it would split g; changes stays empty
});
```

- [ ] **Step 2: Run them on the fleet and watch them fail.** Units under `--project=weasel-ui`, and the browser file under `--project=browser`.

- [ ] **Step 3: Implement `groupGripOf`, `groupSlotsAt` and `groupMove`, and add the contribution.** `EffectEditor` already hands `editorReorders` to `ambient` under `rack` and `lanes`, so it needs no change for the drag.

- [ ] **Step 4: Run the tests and `EffectEditor.reorder.browser.test.tsx` on the fleet.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/diagram/src/effect/groupOrder.ts packages/diagram/src/effect/groupOrder.test.ts packages/diagram/src/effect/editorReorder.ts packages/diagram/src/effect/EffectEditor.groupOrder.browser.test.tsx
git commit -m "reorder a group under rack and lanes by dragging its title"
```

### Task 6: Renaming a group under `rack` and `lanes`

**Files:**
- Modify: `packages/diagram/src/dataGroups.ts`, `packages/diagram/src/effect/groupTitle.tsx`, `packages/diagram/src/effect/EffectEditor.tsx`
- Create: `packages/diagram/src/effect/renameGroupAction.ts`
- Test: `packages/diagram/src/effect/EffectEditor.groupOrder.browser.test.tsx` (rename cases go beside the drag ones)

**Interfaces:**
- Consumes: `groupGripOf` (Task 5).
- Produces:
  - `groupLabelIdOf = (group: string): string => \`${group}/label\`` exported from `dataGroups.ts`, and used where that file mints the id now.
  - `RENAME_GROUP_ACTION_ID = 'effect.renameGroup'`, and `renameGroupContribution(now: () => ReorderSource, rename: (group: string) => void): Contribution`. It is bound to `{ kind: 'doubleClick' }`, is enabled only where a group's grip holds the point, and its `run` reads `params.worldX` and `params.worldY` and calls `rename` with the innermost such group.
  - `useGroupTitle` drops the `look !== 'nodeGraph'` gate. Its overlay target is `titleIdOf(id)` under `nodeGraph`, `groupLabelIdOf(id)` (placement `'center'`) for a labeled group under the other looks, and the group's own id (placement `'top'`) for an unlabeled one.
  - Under `rack` and `lanes`, `EffectEditor` passes `ambient={[...reorders, rename]}`.

- [ ] **Step 1: Write the failing tests**

```ts
it.each(['rack', 'lanes'] as const)('renames a group from a field opened by double-clicking its title under %s', async (look) => {
  // double-click the center of g's label pose; field input[aria-label="Group name"] appears focused;
  // type 'Duo' + Enter
  expect(changes.at(-1)![1]).toBe('Rename group');
  expect(changes.at(-1)![0].pipeline.groups).toEqual([{ id: 'g', label: 'Duo', members: ['a', 'b'] }]);
});
it('renames an unlabeled group from its top band under rack', async () => { /* label absent → field opens; Enter 'New' sets label */ });
it('opens nothing on a double-click on a stage body', async () => { /* no input appears */ });
```

- [ ] **Step 2: Run on the fleet (`--project=browser`) and watch them fail.**

- [ ] **Step 3: Implement it.** Keep the field rule and `GroupTitleField` as they are.

- [ ] **Step 4: Run the file and `EffectEditor.groups.browser.test.tsx` on the fleet.** Expected: PASS. The `nodeGraph` rename must still work.

- [ ] **Step 5: Commit**

```bash
git add packages/diagram/src/dataGroups.ts packages/diagram/src/effect/groupTitle.tsx packages/diagram/src/effect/EffectEditor.tsx packages/diagram/src/effect/renameGroupAction.ts packages/diagram/src/effect/EffectEditor.groupOrder.browser.test.tsx
git commit -m "rename a group by double-clicking its title under rack and lanes"
```

### Task 7: Changeset, docs, and the fleet run

**Files:**
- Create: `.changeset/<name>.md` (`'@weasel-js/diagram': patch`)
- Modify: the spec's Pieces row for groups (mark it built), and `HANDOFF.md`'s fourth-arc section

- [ ] **Step 1: Write the changeset.** Say in plain prose that `chain` now keeps groups together and moves outsiders out of a group's columns (layouts that have groups change), that `ReorderItem.grip` accepts `null`, and that `EffectEditor` reorders and renames groups under `rack` and `lanes`.
- [ ] **Step 2: Run `npm run test:gate` on the fleet** (`onto do --kind typecheck …`), then `npm run test:fleet` on the branch. Expected: green, with a `fleet-tree: N changed path(s) match <sha>` line in the log.
- [ ] **Step 3: Delete this plan, and commit the changeset and doc edits together.**

```bash
git rm docs/superpowers/plans/2026-10-20-chart-arc4-group-layouts.md
git add .changeset HANDOFF.md docs/superpowers/specs/2026-10-20-chart-fourth-arc-design.md
git commit -m "record groups under rack and lanes as built"
```
