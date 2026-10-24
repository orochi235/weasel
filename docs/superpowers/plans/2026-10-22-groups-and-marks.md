# Groups and Marks Implementation Plan

**Status (2026-10-23): Arcs 1–3 are merged; Arc 4 below is unbuilt.** The spec is the design of
record for what landed.

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
