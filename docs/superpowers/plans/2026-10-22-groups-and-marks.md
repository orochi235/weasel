# Groups and Marks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace scene node kinds `leaf | container` with `mark | group`, let any node have
children, make a group behave as one item with `select.deep` / `group.enter` / `group.leave` to reach
inside, and make clips declared.

**Architecture:** Four arcs, each its own branch and merge gate. Arc 1 renames every kind and moves
`children` onto any node without changing behavior: every `container` becomes `group`, diagram bodies
included. Arc 2 moves each behavior to the kind or to "has children" and turns the self-drawing
producers into marks. Arc 3 adds group selection. Arc 4 makes clips declared, fixes draw's loader, and
fixes SVG export.

**Tech Stack:** TypeScript, React, vitest (jsdom projects plus the `browser` project), npm
workspaces, changesets.

**Spec:** `docs/superpowers/specs/2026-10-22-groups-and-marks-design.md`

## Global Constraints

- Every changeset is `patch`; breaking changes are said in its prose, never by the level.
- Each arc is a worktree branch merged to `main` only after `npm run test:fleet -- <tip>` and
  `npm run test:fleet:postbuild -- <tip>` pass with `fleet-tree: … match <tip>`; one session's fleet
  jobs at a time (`docs/TODO.md`, "The fleet-tree check passes on another session's commit").
- Locally, run one test file at a time; directories, several files and the browser project go to the
  fleet (`onto … --kind test`).
- `npm run check:size`: no source file over 400 lines, no function over 120.
- Public types: `MarkNode`, `GroupNode`, `SceneNode` (union), `AddNodeSpec.kind: 'mark' | 'group'`,
  `isLeaf(node)`, `hasChildren(node)`; `ContainerNode` and `LeafNode` removed.
- Saved scenes: `version: 2` written; `version: 1` read with `leaf → mark`, `container → group`
  unless a classifier says otherwise.
- Action ids: `select.deep`, `group.enter`, `group.leave`.
- US English in code, comments, docs and commit messages.

## Review Focus

- **An emptied group** (all members deleted, `types.ts` "an emptied group is still a group") is still
  hit across its box and selectable — Task 9 pins it.
- **A press inside an entered group on a member that is itself a group** selects that inner group,
  not its member — Task 10 pins it.
- **Undo while a group is entered** leaves the entered group as it was, since it is not scene data,
  and undoing the group's deletion while entered leaves it — Task 11 pins it.
- **A locked or hidden member** under a press: the press resolves to the group even when the hit
  member is locked, and `select.deep` skips locked members as picking does today — Task 10 pins it.
- **A version 1 envelope** (`dependsOn: 'children'` with `derivePose`) loads as a group whose box
  still derives from its children — Task 2 pins it.

---

## Arc 1: kinds and children (behavior-neutral)

Branch `feat/groups-marks-1`. Nothing a user can see changes in this arc.

### Task 1: Node types and the tree store

**Files:**
- Modify: `packages/core/src/core/scene/types.ts` (`LeafNode`, `ContainerNode`, `Node`, `AddNodeSpec`, the `ContainerNode` and `SceneNode` doc comments)
- Create: `packages/core/src/core/scene/treeShape.ts`
- Modify: `packages/core/src/core/scene/nodeStore.ts` (`siblingsOf` :108, :135, :198), `packages/core/src/core/scene/treeEdits.ts` (:50, :86, :149), `packages/core/src/core/scene/nodeFnFields.ts` (`containersOnly` → `groupsOnly` for now)
- Modify: `packages/core/src/barrel/scene.ts`, `packages/core/src/core/scene/index.ts`
- Test: `packages/core/src/core/scene/treeShape.test.ts`

**Interfaces:**
- Produces: `interface MarkNode<TData, TLayer, TPose> extends NodeBase { kind: 'mark' }` and
  `interface GroupNode<…> extends NodeBase { kind: 'group' }`. `NodeBase` gains `children?: NodeId[]`
  and the fields that were `ContainerNode`'s: `clipFromPose?`, `copiesFromPose?`, `layout?`, `units?`.
  `Node = MarkNode | GroupNode`.
- Produces: `isLeaf(node: { children?: readonly NodeId[] }): boolean` (true when absent or empty)
  and `hasChildren(node): node is … & { children: NodeId[] }` in `treeShape.ts`, exported from
  `@weasel-js/core`.
- Produces: `AddNodeSpec.kind: 'mark' | 'group'`.

- [ ] **Step 1:** Write `treeShape.test.ts`: `isLeaf({})` is true; `isLeaf({ children: [] })` is true;
  `hasChildren({ children: ['a'] })` is true; and a scene test where
  `scene.add({ kind: 'mark', id: 'm' … })` then `scene.add({ kind: 'mark', id: 'c', parent: 'm' … })`
  leaves `scene.childrenOf('m')` equal to `['c']`.
- [ ] **Step 2:** Run `npx vitest run --project=core packages/core/src/core/scene/treeShape.test.ts`. Expected: FAIL, `treeShape` missing.
- [ ] **Step 3:** Implement the types and `treeShape.ts`. The store reads `node.children ?? []`
  wherever it narrowed on `kind === 'container'` to read children, creates `children` on a node when
  it gets its first child, and stops throwing "is not a container" in `treeEdits.ts`. The function
  fields stay group-only in this arc (rename the flag to `groupsOnly`), so behavior doesn't move.
- [ ] **Step 4:** Run the same test. Expected: PASS.
- [ ] **Step 5:** Commit: `let any node have children, and name the node kinds mark and group`.

### Task 2: Save format version 2

**Files:**
- Modify: `packages/core/src/core/scene/serializedTypes.ts` (`SerializedNode.kind`, `SerializedScene.version`), `packages/core/src/core/scene/serialization.ts` (:94 write, :107 read), `packages/core/src/core/scene/historyForm.ts` (`SCENE_HISTORY_FORM` → 3)
- Test: `packages/core/src/core/scene/serialization.v1.test.ts`

**Interfaces:**
- Consumes: Task 1's kinds.
- Produces: `specsFromSerialized(json, registry, opts?: { classifyV1?: (node: SerializedNodeV1) => 'mark' | 'group' })`, where `SerializedNodeV1` is version 1's node shape (`kind: 'leaf' | 'container'`).

- [ ] **Step 1:** Write the tests:
  - `toJSON()` writes `version: 2` and `kind: 'mark'` / `'group'`.
  - A version 1 scene with a `leaf`, a `container` and a child loads as `mark`, `group`, child intact.
  - With `classifyV1: () => 'mark'`, the container loads as `mark` and keeps its children.
  - A version 1 envelope (`dependsOn: 'children'`, `derivePoseKey` set) loads as a group whose
    effective pose equals its children's union. Review Focus.
  - `version: 3` throws `unsupported version 3`.
- [ ] **Step 2:** Run the file. Expected: FAIL on the version and kind assertions.
- [ ] **Step 3:** Implement. A version 1 node's function-field keys are read exactly as before.
- [ ] **Step 4:** Run it. Expected: PASS.
- [ ] **Step 5:** Commit: `save scenes as version 2 with mark and group kinds, and read version 1`.

### Task 3: Rename every producer and reader

**Files:** every non-test and test site naming `'leaf'` or `'container'` as a kind. Outside tests:
core 66, diagram 10, symmetry 6, svg 5, apps/draw 5, apps/site 5, devtools 3, diagram-formats 2, plus
kernel3d's `testScene.ts`, labkit fixtures, `diagram/src/index.ts` and `layout.entry.ts`
(`BodyNodeSpec.kind`). Find them with
`grep -rn "'container'\|'leaf'\|ContainerNode\|LeafNode" packages apps --include='*.ts' --include='*.tsx'`.

**Interfaces:**
- Consumes: Task 1.
- Produces: no `container` or `leaf` kind anywhere. Each `kind === 'container'` becomes
  `kind === 'group'`, or `hasChildren(node)` where it only read `children` (the ~15 sites in
  `treeReads`, `nodeStore`, `renderOrder`, `treeOrder`, `treeEdits`, `kitOps`, `staleReplay`,
  `sceneClipboard`, `devtools/handlers`). Each `kind === 'leaf'` becomes `kind === 'mark'`.

- [ ] **Step 1:** Rename mechanically. Every producer of `container` becomes `group`, diagram bodies,
  regions, MoveSnap bins and platformer bones included (Arc 2 turns those into marks).
- [ ] **Step 2:** Rewrite `docs/taxonomy.md` "Group vs Selection" for the two kinds, and update
  `apps/draw/src/sceneLoading.ts`'s version gate to accept 1 and 2.
- [ ] **Step 3:** Changeset `.changeset/groups-marks-kinds.md`, `patch` for every package touched.
  Prose: the kinds are now `mark` and `group`, any node may have children, `ContainerNode`/`LeafNode`
  are now `GroupNode`/`MarkNode`, scenes save as version 2, and version 1 loads with containers as
  groups unless `classifyV1` says otherwise.
- [ ] **Step 4:** Run `npm run test:fleet -- HEAD` and `npm run test:fleet:postbuild -- HEAD`.
  Expected: green with the tip's match line; typecheck in the gate is the proof that no site was
  missed.
- [ ] **Step 5:** Commit: `rename leaf and container to mark and group in every package`; merge Arc 1.

## Arc 2: what the kind decides

Branch `feat/groups-marks-2`, from `main` after Arc 1.

### Task 4: A group never paints, and is hit across its box

**Files:**
- Modify: `packages/core/src/canvas/defaultDrawOne.ts` (never call a painter for a group),
  `packages/core/src/canvas/nodeShapes/pathPainter.ts` and `rectFallbackPainter.ts` (drop their kind
  checks), `packages/core/src/canvas/nodeShapes/nodePaint.ts` (`CONTAINER_INK` removed),
  `packages/core/src/canvas/NodeShape.ts` (:224, a group's interior is its box)
- Test: `packages/core/src/canvas/groupPaint.test.ts`

- [ ] **Step 1:** Write the tests. A group with `data: { shape: 'rect', fill: RED }` emits no path
  command, and neither does a group with `data: { path, fill: RED }`. A mark with a child and
  `data.shape` emits its own path. A point inside a group's box with no member under it hits the
  group, and the same point hits it after its last member is deleted (Review Focus).
- [ ] **Step 2:** Run the file. Expected: FAIL on "a group with `data.shape` emits nothing".
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run it. Expected: PASS.
- [ ] **Step 5:** Commit: `never paint a group, and hit it anywhere in its box`.

### Task 5: Ungroup, marquee, bounds, routing and the status bar read the kind

**Files:**
- Modify: `packages/core/src/interactions/actions/defaults/group.ts` (:146 groups only),
  `packages/core/src/canvas/deps/hitTestArea.ts` (`includeContainers` → `includeGroups`),
  `packages/core/src/canvas/drawnBounds.ts` (:78), `packages/core/src/canvas/SceneCanvas/defaultNodeRouting.ts`,
  `apps/draw/src/EditorStatusBar.tsx`, `packages/core/src/canvas/sceneAdapter.ts` (:233, :243)
- Test: `packages/core/src/interactions/actions/defaults/group.marks.test.ts`, `packages/core/src/canvas/drawnBounds.marks.test.ts`

- [ ] **Step 1:** Write the tests:
  - Ungroup with a mark that has children selected leaves the scene unchanged.
  - Marquee over a group and its members returns the members unless `includeGroups: true`.
  - A mark with a stroke of width 10 and one child inside it has drawn bounds that include its own
    stroke.
  - `inferredNodeRouting` routes a mark with children by its data, not as `'group'`.
- [ ] **Step 2:** Run each file. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run each. Expected: PASS.
- [ ] **Step 5:** Commit: `ungroup, select by area, bound and route by kind, not by having children`.

### Task 6: Children decide clip, copies, layout, units, drops and inheritance

**Files:**
- Modify: `packages/core/src/core/scene/nodeFnFields.ts` (drop `groupsOnly`),
  `packages/core/src/core/scene/fieldEdits.ts` (:58, :101), `sceneState.ts` (:56),
  `packages/core/src/interactions/actions/move/session.ts` (`admitsOf` :95),
  `move/commit/reparent.ts` (:47), `insert/parent.ts` (:12), `move/layout/exits.ts` (:46),
  `packages/core/src/core/scene/inheritedPaint.ts` (:46)
- Test: `packages/core/src/interactions/actions/move/admits.test.ts`, `packages/core/src/core/scene/inheritedPaint.marks.test.ts`

**Interfaces:**
- Produces: `admitsOf(canDropInto, ids, scene)`. With no `canDropInto`, a parent admits only when it is a group.

- [ ] **Step 1:** Write the tests:
  - `setLayout` on a mark stores the layout.
  - With no `canDropInto`, a drop onto a mark lands beside it, and onto a group lands inside it.
  - With `canDropInto` returning true for a mark, the drop lands inside it.
  - A child with `fill: 'inherit'` under a mark with a red fill paints red.
- [ ] **Step 2:** Run each. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run each. Expected: PASS.
- [ ] **Step 5:** Commit: `let any node clip, copy, lay out and pass paint to its children, and drop only into groups by default`.

### Task 7: Self-drawing producers become marks

**Files:**
- Modify: `packages/diagram/src/buildBody.ts` (:74), `packages/diagram/src/containers/regionSpecs.ts` (:69),
  `apps/site/demos/MoveSnapDemo.tsx` (:21), `apps/site/demos/platformer/sceneWorld.ts` (:156: every
  bone is a mark)
- Test: `packages/diagram/src/body.marks.test.ts`, `packages/diagram/src/containers/regions.marks.test.ts`

- [ ] **Step 1:** Write the tests:
  - A built diagram body is a mark whose rows are its children.
  - Ungroup on a selected body leaves it whole.
  - A press inside an unfilled lane's interior, with no member under it, hits the lane.
  - Dragging a box into a lane reparents it into the lane, through diagram's `canDropInto`.
- [ ] **Step 2:** Run each. Expected: FAIL on the kind.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run each. Expected: PASS.
- [ ] **Step 5:** Changeset `patch` (core, diagram) describing the behavior moves in Tasks 4–7; then
  fleet and postbuild on the tip, and merge Arc 2.

## Arc 3: a group is one item

Branch `feat/groups-marks-3`, from `main` after Arc 2.

### Task 8: The entered group

**Files:**
- Create: `packages/core/src/canvas/deps/enteredGroup.ts`
- Modify: wherever `SelectionApi` is provided to actions (`packages/core/src/canvas/SceneCanvas/`), so the dep is in `ActionDeps`
- Test: `packages/core/src/canvas/deps/enteredGroup.test.ts`

**Interfaces:**
- Produces: dep `enteredGroup: { get(): NodeId | null; enter(id: NodeId): void; leave(): void; subscribe(fn: () => void): () => void }`.
  `leave()` moves to the nearest group above the current one, or null. If the entered group leaves the
  scene, `get()` returns the nearest surviving group above it, or null. Not part of history.

- [ ] **Step 1:** Write the tests: enter, then `leave()` with nested groups, and the entered group
  removed from the scene. Undoing a change while entered doesn't move it (Review Focus).
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run it. Expected: PASS.
- [ ] **Step 5:** Commit: `keep the entered group beside the selection`.

### Task 9: A press selects the outermost group

**Files:**
- Modify: `packages/core/src/tools/builtin/pickTopMostHit.ts` (or a new `pressTarget.ts` beside it,
  if `pickTopMostHit` would pass 400 lines), `packages/core/src/tools/builtin/select/pressDecision.ts`
  (`isExtend = mods.shift`), the `select.pick` action
- Test: `packages/core/src/tools/builtin/select/useSelectTool.groups.test.tsx`

**Interfaces:**
- Produces: `pressTarget(scene, hitId, entered: NodeId | null): NodeId`, which returns the outermost
  group above `hitId` that is below `entered`, or `hitId` itself when there is none.

- [ ] **Step 1:** Write the tests:
  - A press on a member selects its group, and a press on a nested member selects the outermost group.
  - Shift-press on a second group's member adds that group. Cmd-press doesn't extend (it goes to `select.deep`).
  - A press on the group's empty box selects it, including when the group is empty (Review Focus).
  - Dragging a member moves the whole group.
  - A press on a locked member still selects its unlocked group (Review Focus).
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run it. Expected: PASS.
- [ ] **Step 5:** Commit: `select a group as one item when any member is pressed`.

### Task 10: `select.deep`

**Files:**
- Create: `packages/core/src/interactions/actions/defaults/selectDeep.ts`
- Modify: `packages/core/src/tools/builtin/select/useSelectTool.ts` (binding above `select.pick`)
- Test: `packages/core/src/tools/builtin/select/useSelectTool.deep.test.tsx`

**Interfaces:**
- Produces: action `select.deep`. Default binding: `{ kind: 'pointerDown', target: { kindOf: onBody }, mods: { mod: true, shift: 'optional' } }`,
  id `select.deep`. It selects the hit node itself, or adds it with Shift.

- [ ] **Step 1:** Write the tests:
  - Cmd-press on a member two groups deep selects that member.
  - Cmd-Shift-press adds a second member.
  - Cmd-press on a locked member selects nothing new (Review Focus).
  - Inside an entered group, a press on a member that is itself a group selects that group (Review Focus).
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run it. Expected: PASS.
- [ ] **Step 5:** Commit: `add select.deep, bound to Cmd-press, to select past every group`.

### Task 11: `group.enter` and `group.leave`

**Files:**
- Create: `packages/core/src/interactions/actions/defaults/enterGroup.ts`
- Modify: `useSelectTool.ts` (bindings), `packages/core/src/canvas/doubleClickTarget.ts` (inside an
  entered group, a double-click on a non-group member falls through to today's targets)
- Test: `packages/core/src/tools/builtin/select/useSelectTool.enter.test.tsx`, `packages/core/src/tools/builtin/select/groupEnter.browser.test.tsx`

**Interfaces:**
- Consumes: Task 8's `enteredGroup`, Task 9's `pressTarget`.
- Produces: action `group.enter` (binding `{ kind: 'doubleClick', target: { kindOf: onBody } }`,
  which enters the group `pressTarget` would select), and `group.leave` (bindings
  `{ kind: 'key', key: 'Escape' }`, plus a `pointerDown` outside the entered group's box).

- [ ] **Step 1:** Write the tests:
  - Double-click a member: the group is entered, and a press then selects the member.
  - A second double-click on a nested group's member enters that nested group.
  - Double-click a text member inside an entered group: text editing starts.
  - Escape leaves one level; a press outside leaves it.
  - Undoing the group's deletion while it is entered leaves it entered on the restored group, and
    deleting it leaves the parent entered (Review Focus).
  - The browser test drives real double-click events on a draw-like scene and checks the selection.
- [ ] **Step 2:** Run the jsdom file locally, and the browser file on the fleet with `--kind test`. Expected: FAIL.
- [ ] **Step 3:** Implement. The entered group is drawn as a frame around its box; style it in the select tool's existing chrome layer.
- [ ] **Step 4:** Run both. Expected: PASS.
- [ ] **Step 5:** Changeset `patch` for core: groups select as one item, double-click enters, Cmd-click
  selects deep, and Cmd-click no longer extends the selection (Shift does). Then fleet and
  postbuild, and merge Arc 3.

### Task 11a: Isolation becomes a way of showing the entered group

Isolation mode and the entered group were the same idea built twice, and `group.enter` took
isolation's only way in. Ruled: unify (2026-10-23). The entered group is the one notion of being
inside a group; isolation is a presentation of it, not a mode.

**Files:**
- Modify: `packages/core/src/canvas/deps/enteredGroup.ts`, `packages/core/src/canvas/SceneCanvas/useScenePicking.ts`,
  `pointerProps.ts`, `canvasPassThrough.ts` (prop `enteredGroup`, prop `isolatedGroup` removed),
  `packages/core/src/canvas/doubleClickTarget.ts`, `packages/core/src/features/modes/modeTriggers.ts` (docs),
  `enterGroup.ts`, `enterTextEdit.ts`, `enterPathEdit.ts` (eligibility no longer names `isolation`),
  `packages/core/src/features/selection/enteredGroupFrame.ts`
- Create: `packages/core/src/features/selection/enteredGroupScope.ts` (dim and lock outside the entered group)
- Modify: `packages/modes/src/presets/default.ts` (remove `ISOLATION`), `packages/modes/src/scopingLayer.ts` (docs)
- Modify: `apps/draw/src/modality/{modeScope,useCanvasModes,useModality}.ts`, `apps/draw/src/Workspace.tsx`,
  the breadcrumb and workspace tint in `apps/draw/src/modality/chrome/`

**Interfaces:**
- Produces: `<SceneCanvas enteredGroup={dep}>`, consumer-owned as `selection` is; without it the
  canvas makes its own. `useEnteredGroup(scene)` and `EnteredGroupApi` are public.
- Produces: `createEnteredGroupScope({ entered, scene, dimAlpha? })` →
  `{ alphaFor(id), isPointerInteractive(id), subscribe(fn), getVersion() }`: everything outside the
  entered group's subtree dims and stops taking hits; with nothing entered, every node is lit and live.
- Removes: `ISOLATION` from `@weasel-js/modes`, `<SceneCanvas isolatedGroup>`, draw's `isolatedGroupOf`.

**Also fixed here (Task 11 review):**
- Leaving on an outside press is its own rebindable binding, not code inside `select.pick` / `select.deep`.
- The frame's color is a theme token, overridable.
- The frame and the leave check read the group's box through one function.
- Escape: an open mode (text edit, path edit, a strict mode) takes Escape before `group.leave` does.

- [ ] **Step 1:** Write the tests:
  - Draw: double-click a member, and everything outside the group dims, can't be pressed, the
    workspace is tinted, and the breadcrumb names the group. Escape leaves one level; the
    breadcrumb's exit leaves every level.
  - A press inside the entered group selects the member (the bug isolation had).
  - Double-click a path inside an entered group opens path edit, and the group stays entered;
    Escape closes path edit first, then a second Escape leaves the group.
  - Escape while editing text inside an entered group ends the text edit and leaves the group entered.
  - A consumer rebinds the outside-press leave to nothing, and an outside press then keeps the group.
  - `createEnteredGroupScope` unit tests: nested groups, nothing entered, the group deleted.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run them, plus Task 11's browser test on the fleet. Expected: PASS.
- [ ] **Step 5:** Commit. The Task 11 changeset prose also says `ISOLATION` and `isolatedGroup` are gone.

## Arc 4: declared clips, draw's loader, SVG export

Branch `feat/groups-marks-4`, from `main` after Arc 3.

### Task 12: Clip only when declared

**Files:**
- Modify: `packages/core/src/core/scene/types.ts` (`NodeBase.clip?: 'outline'`), `serializedTypes.ts`
  and `serialization.ts` (`clip` round-trips), `packages/core/src/canvas/buildSceneTree.ts` (:128),
  `packages/core/src/canvas/pickWalk.ts` (`ownClipOf` :151), `adapterPointQuery`,
  `packages/svg/src/unpack.ts` (a `<g clip-path>` group gets `clip: 'outline'`), draw's
  `openSvg.ts`/`svgInterop.ts`, `packages/diagram/src/buildBody.ts` (drop `clipNothing`),
  `apps/site/demos/platformer/sceneWorld.ts` (drop `() => null`), `packages/symmetry/src/group.ts`
- Test: `packages/core/src/canvas/clip.declared.test.ts`

**Interfaces:**
- Produces: `clip?: 'outline'` on any node. A node clips its children to `clipFromPose(pose)` when it
  has one, otherwise to its own outline when `clip === 'outline'` (the painter's silhouette for a
  mark, `data.path` for a group), and otherwise not at all. A version 1 load sets `clip: 'outline'`
  on every container with no `clipFromPoseKey`, so saved scenes keep today's look.

- [ ] **Step 1:** Write the tests:
  - A mark with children and no clip draws a child outside its box.
  - With `clip: 'outline'` the child is clipped to the mark's silhouette.
  - An imported `<g clip-path>` clips its children.
  - A version 1 container without a clip key loads with `clip: 'outline'`.
  - `clipNothing` still resolves from the registry.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run it. Expected: PASS.
- [ ] **Step 5:** Commit: `clip a node's children only when it declares a clip`.

### Task 13: Draw restores every saved field

**Files:**
- Modify: `apps/shared/editor/src/snapshot.ts` (:66–89)
- Test: `apps/shared/editor/src/snapshot.fields.test.ts`

- [ ] **Step 1:** Write the test: a scene holding a symmetry group (`copiesFromPose`), a group with
  `clip: 'outline'` and a node with `units` survives `toJSON` → `nodeSpecsFromSnapshot` with all
  three intact.
- [ ] **Step 2:** Run it. Expected: FAIL on copies and units.
- [ ] **Step 3:** Implement through core's `specsFromSerialized` rather than a second reading of the fields.
- [ ] **Step 4:** Run it. Expected: PASS.
- [ ] **Step 5:** Commit: `restore clips, copies and unit scopes when draw reloads a scene`.

### Task 14: SVG export writes a mark with children

**Files:**
- Modify: `packages/svg/src/fromKit.ts` (:265), `packages/diagram-formats/src/pageNodes.ts` (:135, remove the outline workaround)
- Test: `packages/svg/src/fromKit.marks.test.ts`

- [ ] **Step 1:** Write the tests. A mark with a rect shape and one child exports as `<g>` holding a
  `<rect>`, then the child's element. A group exports as `<g>` with no shape of its own. A diagram
  page exports its boxes' outlines with no `pageNodes` special case.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run it. Expected: PASS.
- [ ] **Step 5:** Changeset `patch` (core, svg, diagram, diagram-formats, symmetry) for Arc 4. Then
  fleet and postbuild, and merge Arc 4. Delete this plan and the spec after moving anything worth
  keeping into `docs/taxonomy.md`. Update `docs/TODO.md`: retire the container-inherit entry's
  "whether a diagram node is a group" note, and the draw reload issue.
