## createAddGuideOp and createReplaceGuideOp record an undo step for a write that changed nothing
- where: packages/guides/src/guides/ops.ts:24 (createAddGuideOp `apply`), packages/guides/src/guides/ops.ts:42 (createReplaceGuideOp `apply`)
- scenario: the store already holds a guide equal to the one being added (same id, axis, offset, span), or a replace whose `to` equals what the store holds. `useGuides().addGuide` returns early on `sameGuide` and writes nothing, but `apply` returns `undefined` rather than `'noop'`, so the canvas's history records a "Add Guide"/"Move Guide" step whose undo also does nothing (the inverse replace puts back an identical guide). `createRemoveGuideOp` in the same file returns `'noop'` when its write changes nothing, so the three op factories answer "did this change the store" two different ways. Only `rulers/actions.ts`'s `guideEdit` guards against it for replace, and only by comparing `offset`; any other caller (a consumer re-adding a guide, a replace that differs only in `span`, an add over an identical guide) gets an empty undo step. Expected: `apply` returns `'noop'` when the guide it read under the id is equal to the one it writes.
- evidence: read
- severity: low

## siblingBounds/worldBoundsOf ignore parallax planes, which deriveAlignmentGuides carries out to the camera's world
- where: packages/guides/src/guides/alignment/sceneBounds.ts:23 (worldBoundsOf), :73 (siblingBounds)
- scenario: siblings on a `parallax` layer. `deriveAlignmentGuides` takes `planeOf` and maps each box through `rectFromPlane` because "the lines are in the camera's world" (derive.ts:23–25, types.ts:23–27). `siblingBounds`, documented as what an equal-spacing snap measures gaps between, returns the boxes in the plane each pose is stored in, with no `planeOf` option, and `matchSpacing`'s returned gaps are drawn by `createGuidesLayer`, which projects them through the canvas view as camera-world coordinates. So for a parallax sibling the gaps (and the box's alignment to them) are measured and drawn in a different world than the alignment lines from the same siblings, and the gap markers land offset from the boxes by the plane's shift/scale. Expected: one answer to "which world are sibling boxes in" — `SceneBoundsOptions` takes the same `planeOf` (or the readers return camera-world boxes) so spacing and alignment agree.
- evidence: read (the mismatch in the two readers is read; that a real consumer hits it on a parallax layer is inferred)
- severity: low

## Files read
packages/guides/src/guides/alignment/derive.ts
packages/guides/src/guides/alignment/finite.ts
packages/guides/src/guides/alignment/index.ts
packages/guides/src/guides/alignment/match.ts
packages/guides/src/guides/alignment/sceneBounds.ts
packages/guides/src/guides/alignment/spacing.ts
packages/guides/src/guides/alignment/types.ts
packages/guides/src/guides/index.ts
packages/guides/src/guides/layer.ts
packages/guides/src/guides/ops.ts
packages/guides/src/guides/types.ts
packages/guides/src/guides/useGuides.ts

<!-- done: 2 findings, files read: 12 -->
