# Audit round 46 — diagram.containers

Note: the tree's HEAD is 782733b19c, not the brief's 6438325 (that object is absent from this repo); the listed
files have no uncommitted changes, so the findings are against HEAD.

## regionHeaderAt tests a world point against each region's stored (parent-local) pose
- where: packages/diagram/src/containers/containerTitle.ts:29 (regionHeaderAt)
- scenario: diagram scenes store a lane in its pool's frame and a nested container in its parent's (fromData and
  containerBuild localize with RIGID_POSE_COMPOSITION; addLane says "In the pool's own frame, where its lanes are
  stored"). `headerBox(node.pose, …)` is that local box, while `at` is world. Pool at world (400, 300), rows axis: a
  double-click on a lane's left header at world (445, 350) is tested against the lane's local header x 32..60,
  y 0..h, misses, walks to the pool (header x 400..432) and misses → `null`, so the title edit never starts. Worse,
  a local header box can happen to contain an unrelated world point and the double-click edits the wrong region's
  title. It works only when every ancestor sits at the origin. Should compare against the world pose
  (`worldWith(scene)(id)`, as `poolsOf` does).
- evidence: read
- severity: high

## Releasing a lane puts its members beneath the pool, under the pool's fill
- where: packages/diagram/src/containers/containerStencils.ts:147-148 (releasePlan) / :174 (releaseMembers)
- scenario: for a lane, `beside` is the pool, `index` is the pool's own index in its parent, and each member is
  `scene.move(m, parent, index + k)` — inserted before the pool in sibling order, so drawn below it. The pool stays
  (only the lane is removed) and has an opaque fill (`regionData` gives every non-lane region `fill`), and the
  members still sit inside the pool's box. Release members on a lane holding a shape → the shape vanishes behind
  the pool. For a plain container this is harmless because the container itself is removed; for a lane the members
  should go after the pool (index + 1 + k).
- evidence: read (z-order inferred from sibling order = draw order; no test covers releasing a lane)
- severity: medium

## diagramCanDropInto's "plain group" branch admits drops into any mark without a participant trait
- where: packages/diagram/src/containers/canDropInto.ts:40 (diagramCanDropInto, `allowed`)
- scenario: the doc says "Any other container — a plain group — takes anything but a lane", but the branch never
  checks `node.kind === 'group'`; it accepts any node for which `dataKeyReader` is null and that is not an edge or
  label. `dataKeyReader` is also null for a container's title text, a plain text/image mark with no `diagram` data,
  a sequence root or part (`seq`/`sequence` — "the sequence edits them as data"), and a node whose trait has
  `anchor` or `mark`. Core treats a `true` verdict on a mark as "drop inside it" (editing's move `dropOnto`, insert
  `parent`), so dragging a shape onto a sequence root or a stray text mark reparents the shape under it.
- evidence: read
- severity: medium

## diagramDropParentAt places stencil inserts into locked or hidden containers, bypassing the drop rules
- where: packages/diagram/src/containers/canDropInto.ts:71-84 (diagramDropParentAt)
- scenario: the walk picks the innermost container/lane whose body holds the point with no regard for
  `isLocked`/`isHidden` (DropParentScene has neither) and without asking `diagramCanDropInto`/`canReparent`.
  `useStencilInsert` (stencilTool.ts:83) uses the answer as the new node's parent outright. Drawing a stencil over a
  locked container inserts a child into it, where core's own insert path (`admitsChild`: "a locked parent takes
  nothing") refuses; over a hidden container the new node is born invisible; a host `canReparent` that refuses a
  lane is never asked. Should skip hidden/locked regions and defer to the canDropInto verdict.
- evidence: read
- severity: medium

## addLane at an index colors the new lane by child order, not its place in the stack
- where: packages/diagram/src/containers/containerStencils.ts:118-121 (addLane)
- scenario: the comment says a themed scene "colors the lane as a theme change would, by its place in the stack",
  but `themeWrites` → `laneIndex` (theme/themeWrites.ts:47) ranks lanes by `childrenOf` order, and the new lane is
  appended last there whatever `index` was. `addLane(scene, pool, 0)` in a themed pool with alternating bodies
  stacks the lane first but gives it the stripe of the last slot, so two adjacent lanes share a color. Lanes
  reordered by drag have the same mismatch (stack order comes from poses via `lanesOf`, color from child order).
- evidence: read
- severity: low

## Lane affordances and the resize drag ignore a pool's rotation
- where: packages/diagram/src/containers/laneBoundaryLayer.ts:105-110 (boundaryOf), :156-159; containerActions.ts:125 (sizeAt)
- scenario: a pool under RIGID composition can be rotated (the rotate action, or a rotated parent container). The
  boundary path and add-lane point are built from `lane.at`/`pool.at`'s x/y/width/height only, dropping `rotation`,
  so they draw and hit-test as an axis-aligned box off the rotated pool; the drag then measures world `y` (or `x`)
  delta against a stored size along the pool's own axis, so the lane grows by the wrong amount or the wrong sign.
- evidence: read
- severity: low

## containerBuild localizes with RIGID_POSE_COMPOSITION while addLane uses the scene's composition
- where: packages/diagram/src/containers/containerStencils.ts:68 (containerBuild) vs :115 (addLane)
- scenario: the same question — how a lane's and title's world pose is stored under its region — is answered with
  the hard-coded rigid composition in containerBuild and with `scene.composition` in addLane. `diagramScene` accepts
  a `composition` option; in a scene built with a non-rigid one, a stencil-drawn pool's lanes and titles are stored
  under the wrong rule and draw displaced, while lanes added later are right. ContainerBuildOptions offers no way to
  pass the composition.
- evidence: read
- severity: low

## Files read
packages/diagram/src/containers/canDropInto.ts
packages/diagram/src/containers/containerActions.ts
packages/diagram/src/containers/containerLayout.ts
packages/diagram/src/containers/containerStencils.ts
packages/diagram/src/containers/containerTitle.ts
packages/diagram/src/containers/index.ts
packages/diagram/src/containers/laneBoundaryLayer.ts
packages/diagram/src/containers/laneStack.ts
packages/diagram/src/containers/layouts.ts
packages/diagram/src/containers/regionSpecs.ts
packages/diagram/src/containers/titlePose.ts
packages/diagram/src/containers/trait.ts

<!-- done: 7 findings, files read: 12 -->
