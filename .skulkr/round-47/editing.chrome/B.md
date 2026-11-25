# Audit round 47 — area `editing.chrome`

Note: the checkout's HEAD is `782733b19c`; the brief's frozen commit `44e73a944bea29d4d56fc7883fa302daec48ecf1`
does not exist in this repository (`git cat-file` reports a bad object), so the files were read as they stand at HEAD.

## The overlay paints a rotate badge on a selection the rotate affordance refuses, so the badge cannot be grabbed
- where: packages/editing/src/chrome/overlay.ts:243 (buildSelectionLayer, draw)
- scenario: a canvas whose geometry declares `supportsRotation` false for a node's pose (or a multi-selection
  containing one such node), with `rotationHandle` on. `createRotationAffordance`'s `pickTarget`
  (packages/editing/src/chrome/affordances/rotationHandle.ts:156, :164-168) returns no regions because
  `state.canRotate(id)` is false, but the overlay's rotation pass loops over `ids` and calls
  `rotationHandleCommands` without consulting `chromeState.canRotate`. The only other gate,
  `isVisible('selection.rotation-handle')`, has no rotatable condition
  (packages/core/src/domains/chrome-caps/defaults.ts:32-38, unlike resize-handles' `{ resizable: true }`).
  Result: the badge is painted over a node that cannot rotate, and a press on it falls through to whatever is
  underneath (move/marquee) instead of rotating. Should: skip the badge for any id (or, for the multi id, any
  selected member) where `chromeState.canRotate` answers false — the same decision the affordance makes.
- evidence: read
- severity: medium

## Selection boxes measured through `boxReader` ignore the scene's own node painters (`scene.shapes` dropped)
- where: packages/editing/src/chrome/selectionPose.ts:48-51 (boxReader)
- scenario: a scene whose `DrawnBoundsScene.shapes` registers a custom painter with its own `drawnBounds`
  (or overrides a kit painter). `boxReader` wraps the scene as `{ get, derivedPathOf }` to strip `childrenOf`,
  but in doing so also drops `shapes`, so `drawnBoundsOf` / `drawnAabbOf` fall back to `defaultNodeShapes`
  (packages/core/src/canvas/drawnBounds.ts:33, :151, :176). The overlay's box outline and resize handles
  (`containerAwareBoundsResolver`, used by overlay.ts:175) and `composeSelectionPose`'s container union are then
  sized by the default painter's stroke reach (or the bare pose box when the default registry has no entry),
  while the shape outline in the same layer (shapeOutline.ts:77-81) and the hit-test use `scene.shapes`.
  The outline/handles sit inside or outside the node's real ink. Should: forward `shapes` alongside `get` and
  `derivedPathOf`.
- evidence: read
- severity: medium

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

<!-- done: 2 findings, files read: 10 -->
