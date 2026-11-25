# Audit round 87 — editing.actions.move

## snapToContainer hands followerOps a container id where a page id is expected, so a dragged node's followers are moved to the page run
- where: packages/editing/src/actions/move/behaviors/snapToContainer.ts:177 (plantOps, `landed.set(id, snap.parentId)`); packages/editing/src/actions/move/capture.ts:134 (buildGestureContext, `followerOps` passes `landed` straight to `followerOpsFor`)
- scenario: paged scene; drag node N (which has a follower F, `dependsOn: [N]`) and dwell-snap it into a group G on the same page. `plantOps` builds `landed = {N → 'G'}`. `followerOpsFor` → `rehomedFollowers` reads each value as a *page id* (`followerLandings` returns it as F's page; every other caller — reparentOps, layoutDropOps, layoutReleaseOps, pageDrops — passes `pageIdOf(...)`). `'G'` is not F's current page, so `homeOfPage(scene, 'G')` runs, `pageNodeOf` finds no page called G and falls back to the run: F is reparented off its page into the page run. It should stay put (same page). `GestureContext.followerOps`'s doc ("reparented under its value") agrees with what snapToContainer passes, so the doc and `buildGestureContext` disagree; the adapter should map each value through `pageIdOf` (or snapToContainer should).
- evidence: read (followerMoves.ts:33-48, pagePlacement.ts:53-133, gestures/types.ts:67-73)
- severity: high

## reparentOnDrop `'into'` re-appends a node dropped back into its own parent, raising it to the front
- where: packages/editing/src/actions/move/commit/reparent.ts:161-169 (reparentOps); target from resolveDrop at :47-58
- scenario: `reparentOnDrop: 'into'`, drag a mark that sits under group G a little, releasing over G itself or over a sibling mark inside G. resolveDrop answers `newParent = G` (the node's current parent). reparentOps does not skip same-parent landings: `landAbove(siblings, id, null)` returns `undefined`, and `landOps` emits `reparent(G → G, toIndex: undefined)`, which appends — the mark jumps to the top of G's z-order on what the user meant as a plain move. pageDrops makes the opposite call for the same question (`if (target !== parent) drops.set(...)`, pageDrop.ts:107), so two drop paths answer "drop onto own parent" differently. Should keep the node's index (no reparent) when `newParent` is the current parent and no `'above'` sibling applies.
- evidence: read
- severity: medium

## clampMove treats a framed bounds rect as axis-aligned, ignoring its rotation and transform
- where: packages/editing/src/actions/move/behaviors/clampMove.ts:31-41 (onMove)
- scenario: `bounds` is a `FramedRect`, whose `rotation`/`transform` (geom/poseFrame.ts:24-37) say the box is drawn turned about its center. clampMove reads only `x/y/width/height`, so for `bounds = {x:0,y:0,width:200,height:50, rotation: π/2}` (a tall box on screen) a node is held inside a wide horizontal strip instead: it can be dragged well outside the drawn box sideways and is stopped inside it vertically.
- evidence: read
- severity: low

## Files read
packages/editing/src/actions/move/action.ts
packages/editing/src/actions/move/behaviors/clampMove.ts
packages/editing/src/actions/move/behaviors/index.ts
packages/editing/src/actions/move/behaviors/layoutDrop.ts
packages/editing/src/actions/move/behaviors/pageDrop.ts
packages/editing/src/actions/move/behaviors/reparentOnDrop.ts
packages/editing/src/actions/move/behaviors/snapBackOrDelete.ts
packages/editing/src/actions/move/behaviors/snapToContainer.ts
packages/editing/src/actions/move/behaviors/swapOnDrop.ts
packages/editing/src/actions/move/capture.ts
packages/editing/src/actions/move/commit/index.ts
packages/editing/src/actions/move/commit/layoutDrop.ts
packages/editing/src/actions/move/commit/layoutRelease.ts
packages/editing/src/actions/move/commit/pageDrop.ts
packages/editing/src/actions/move/commit/rebase.ts
packages/editing/src/actions/move/commit/reparent.ts
packages/editing/src/actions/move/delta.ts
packages/editing/src/actions/move/dragSnap.ts
packages/editing/src/actions/move/frame.ts
packages/editing/src/actions/move/gestureAdapter.ts
packages/editing/src/actions/move/index.ts
packages/editing/src/actions/move/landedDescendants.ts
packages/editing/src/actions/move/layout/container.ts
packages/editing/src/actions/move/layout/dragged.ts
packages/editing/src/actions/move/layout/dropPass.ts
packages/editing/src/actions/move/layout/exits.ts
packages/editing/src/actions/move/layout/glide.ts
packages/editing/src/actions/move/layout/types.ts
packages/editing/src/actions/move/layout/view.ts
packages/editing/src/actions/move/refusal.ts
packages/editing/src/actions/move/session.ts
packages/editing/src/actions/move/sessionOf.ts
packages/editing/src/actions/move/translate.ts

<!-- done: 3 findings, files read: 33 -->
