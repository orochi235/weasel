# Audit round 55 — symmetry (blind reviewer)

## Bake drops the symmetry group's own stated fields and data: a hidden, locked, clipped or labeled group bakes into a bare one
- where: packages/symmetry/src/bake.ts:86 (bakeInBatch)
- scenario: a symmetry group with `hidden: true`, `locked: true`, `pickable: false`, a `clip` or `units`, or `data` beyond `symmetry` (say a `data.label`, which core draws over children) is baked. The replacing plain group gets `data: {}` and none of `statedFields(group)`. So a hidden group's contents and new copies all show, a locked group comes out unlocked, a clipped group's contents stop clipping, and its label is gone. `copySubtree` keeps `statedFields` and `data` for every copy, so the same pass answers "what survives a bake" one way for the children and another for the group. It should carry `statedFields(group)` and the group's data minus `symmetry`.
- evidence: read
- severity: medium

## The guide's mirror lines, spokes and repeat line vanish when the center is more than two canvas diagonals off screen
- where: packages/symmetry/src/guide.ts:134 (createSymmetryGuideLayer draw)
- scenario: each guide line runs from the center's screen point out to `reach = 2 * hypot(dims)` px. Zoom in on a shape far from the center, e.g. a 1000×800 canvas at 10× with the center 400 world units off screen (4000 px > 2×1281 px). A mirror axis that crosses the visible canvas draws nothing, because the segment ends before it reaches the viewport. The lines are documented as "across the canvas". They should be clipped to the viewport rather than given a fixed length measured from the center.
- evidence: read
- severity: medium

## latticePoints' ±512 index clamp drops lattice points inside the extent even when the total is under the copy cap
- where: packages/symmetry/src/wallpaper.ts:46 (latticePoints, range)
- scenario: the index range is clamped to [-SEARCH, SEARCH] whatever the count. Take a one-row strip: spacing 20, extent x −15000..15000, height 0. It holds 1501 lattice points (under MAX_WALLPAPER_COPIES), but only i ∈ [−512, 512] are tried, so 476 in-extent points are never drawn. An extent placed away from the center is worse: extent x 12000..13000 at spacing 20 gives i ∈ [600, 650], which clamps to [600, 512], and draws nothing at all. The docs say "a copy is drawn at every lattice point inside it", and the cap is meant to keep the points nearest the center. The clamp should bound the number of points visited, not the absolute indices.
- evidence: read
- severity: medium

## controller.subscribe is not told when Undo, Redo or another edit changes or removes the active group
- where: packages/symmetry/src/controller.ts:74 (createSymmetry; notify only from setActive/update/preview/bake)
- scenario: the interface says subscribe hears "that the active group, or anything about it, changed", and that `active()` answers null once the group is gone (an undone create). The controller never subscribes to the scene. So Undo of a "Change symmetry" step, Undo past the create, a delete, or a move of the group by the select tool changes what `read(active())` and `active()` return without notifying anyone. A params panel bound to `subscribe` keeps showing the old spec or a group that no longer exists. apps/draw/src/useSymmetry.ts works around this with its own `scene.subscribe`.
- evidence: read
- severity: medium

## Bake drops a copied node's own copiesFromPose, so a node that draws copies of its own bakes into one that doesn't
- where: packages/symmetry/src/bake.ts:135 (copySubtree)
- scenario: a child of the symmetry group is a container with a consumer's own `copiesFromPose`, which core supports generally (not a symmetry group, which is baked first). `copySubtree` carries `clipFromPose`, `layout`, `derivePose` and `statedFields`, but not `copiesFromPose`. Each baked copy of that container draws only its children, while the original, moved as is, still draws its copies. So the copies stop matching what the live symmetry drew.
- evidence: read
- severity: low

## Every write and every cancelled drag rewrites the group's stored spec in normalized form, dropping fields symmetrySpecOf doesn't know, untracked on cancel
- where: packages/symmetry/src/controller.ts:82 (write), packages/symmetry/src/handleDrag.ts:97 (onEnd)
- scenario: `write` stores `{ ...symmetrySpecOf(node.data), ...change.spec }`. A group loaded from a file whose `symmetry` holds a field this version doesn't know (a newer field, or one of the wrong type) loses that field on the first preview frame. On cancel, `preview(id, back)` writes the normalized `origin.spec` back via `scene.untracked`, so a drag cancelled before it changes anything still leaves the document different from before, with no undo step and outside history's record. The center is also re-localized through `centerUnder`, which can leave the pose an ulp off. The restore should put back the node's original `data` and `pose`, not their normalized reading.
- evidence: read
- severity: low

## A wallpaper extent with negative width or height is drawn as a box by the guide but holds no lattice points
- where: packages/symmetry/src/wallpaper.ts:42 (latticePoints) vs packages/symmetry/src/guide.ts:196 (latticeGuide)
- scenario: extent `{ x: 360, y: 240, width: -720, height: -480 }` passes `symmetrySpecOf`'s `isExtent`. The guide normalizes it with `Math.min`/`Math.abs` and outlines the same 720×480 box as the default extent. `latticePoints` returns [] for `width < 0`, so the wallpaper draws only the home cell inside an outlined box that suggests a full lattice. One decision, answered two ways: either both should normalize the box, or `symmetrySpecOf` should refuse it.
- evidence: read
- severity: low

## Files read
packages/symmetry/src/bake.ts
packages/symmetry/src/controller.ts
packages/symmetry/src/frames.ts
packages/symmetry/src/group.ts
packages/symmetry/src/guide.ts
packages/symmetry/src/handleDrag.ts
packages/symmetry/src/index.ts
packages/symmetry/src/kinds.ts
packages/symmetry/src/pbt.fixture.ts
packages/symmetry/src/settings.ts
packages/symmetry/src/wallpaper.ts

<!-- done: 7 findings, files read: 11 -->
