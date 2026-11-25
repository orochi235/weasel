# Audit round 47 — editing.chrome (blind reviewer)

Note: the checkout's HEAD is 782733b19c, not the 44e73a944b named in the brief; line numbers are from the tree as found.

## The overlay paints the rotate badge on a node that cannot rotate, where no grab region exists
- where: packages/editing/src/chrome/overlay.ts:243 (buildSelectionLayer → draw, rotation pass)
- scenario: a canvas whose geometry's `supportsRotation(pose)` is false for the selected node (`ChromeState.canRotate(id)` → false, wired in packages/core/src/canvas/useViewHelpers.ts:258), with `rotationHandle: true` on the selection overlay slot. `createRotationAffordance`'s `pickTarget` (affordances/rotationHandle.ts:156, and :164-167 for a multi-selection with one non-rotatable member) returns null, so neither the ring nor the `rotation-badge` region exists. The overlay gates its badge only on `isVisible('selection.rotation-handle')`, and the chrome-caps rule (core/src/domains/chrome-caps/defaults.ts:32) does not consult `canRotate`, so the badge is still painted. The user sees a rotate badge that does nothing when pressed: no rotate cursor, and the press falls to whatever lies under it. The two paths answer "can this selection rotate" differently. The badge should be skipped wherever the affordance skips the target.
- evidence: read
- severity: medium

## The selection outline drops `dashOffset`, `miterLimit`, `trim` and markers from the consumer's stroke
- where: packages/editing/src/chrome/overlay.ts:62-72 (resolveOutlineStroke)
- scenario: `outline: { dash: [4, 4], dashOffset: 2, miterLimit: 1 }` on the selection overlay slot. `resolveOutlineStroke` rebuilds the stroke from `paint`, `width`, `dash`, `cap`, `join` and `align` only, so `dashOffset` and `miterLimit` never reach the renderer, which does honor them (packages/renderer/src/cache/strokeMeshCache.ts, outlineStrokeMeshCache.ts). The dash starts at phase 0 and joins use the default miter limit. Both the box path (`outlineCommandsFor`) and the shape path (`shapeOutlineCommands`) take this stroke, so neither path can draw the option. The rest of `opts` should be spread through with only the defaults filled in.
- evidence: read
- severity: low

## The shape-outline cache keeps an open path's ink band after its inherited stroke style changes
- where: packages/editing/src/chrome/shapeOutline.ts:89-91 (traceEdge)
- scenario: an open path (a line) inside a group, with stroke fields set to `'inherit'`. The node is selected under `outline.follow: 'shape'`. The group's stroke changes its cap from butt to round, or gains a `markerEnd`, at the same width. The child node object and its memoized silhouette (`findShapeSilhouette` is memoized per node, pose and data) are unchanged, so `key` is the same object. `distance` is the ink outset, which a cap or a marker change does not move. So `held.key === key && held.distance === distance` returns the cached band. That band was built by `inkBand` from the old `ink.stroke` (its caps and heads), and the outline keeps hugging the old cap and arrowhead shape until the node itself changes. The cache key covers neither `ink.stroke` nor `inherited`.
- evidence: read (the trigger, that the outset does not change for a cap or marker edit, is inferred, not measured)
- severity: low

## Files read
packages/editing/src/chrome/affordances/cornerResize.ts
packages/editing/src/chrome/affordances/rotateCursor.ts
packages/editing/src/chrome/affordances/rotationHandle.ts
packages/editing/src/chrome/handleCommands.ts
packages/editing/src/chrome/overlay.ts
packages/editing/src/chrome/rotationBadge.ts
packages/editing/src/chrome/rotationHandleGeometry.ts
packages/editing/src/chrome/selectionChrome.ts
packages/editing/src/chrome/selectionPose.ts
packages/editing/src/chrome/shapeOutline.ts

<!-- done: 3 findings, files read: 10 -->
