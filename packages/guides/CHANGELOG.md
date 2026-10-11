# @weasel-js/guides

## 1.9.4

### Patch Changes

- Updated dependencies [9d54d0a]
- Updated dependencies [01f9a06]
- Updated dependencies [20c2d26]
- Updated dependencies [9f70b3c]
- Updated dependencies [812118e]
- Updated dependencies [e9a28a0]
  - @weasel-js/core@1.9.4
  - @weasel-js/geom@1.9.4

## 1.9.3

### Patch Changes

- Updated dependencies [6a1afa1]
- Updated dependencies [c28a3cb]
- Updated dependencies [7cb27b7]
- Updated dependencies [e05c820]
  - @weasel-js/core@1.9.3
  - @weasel-js/geom@1.9.3

## 1.9.2

### Patch Changes

- Updated dependencies [3ba97df]
- Updated dependencies [1b7af8d]
  - @weasel-js/core@1.9.2
  - @weasel-js/geom@1.9.2

## 1.9.1

### Patch Changes

- Updated dependencies [c63f934]
  - @weasel-js/core@1.9.1
  - @weasel-js/geom@1.9.1

## 1.9.0

### Patch Changes

- Updated dependencies [c06cc26]
- Updated dependencies [dc5bcfc]
- Updated dependencies [0b8d6f8]
- Updated dependencies [0004749]
- Updated dependencies [1b22863]
- Updated dependencies [ad0da6c]
- Updated dependencies [2b03077]
- Updated dependencies [718769e]
- Updated dependencies [3088756]
- Updated dependencies [63d0bf8]
- Updated dependencies [4146713]
- Updated dependencies [24b2eaf]
  - @weasel-js/core@1.9.0
  - @weasel-js/geom@1.9.0

## 1.8.1

### Patch Changes

- Updated dependencies [e07c4ca]
- Updated dependencies [934f195]
- Updated dependencies [7e72192]
- Updated dependencies [bf522cf]
- Updated dependencies [c49c9e0]
- Updated dependencies [2123049]
  - @weasel-js/core@1.8.1
  - @weasel-js/geom@1.8.1

## 1.8.0

### Patch Changes

- Updated dependencies [d24f51f]
- Updated dependencies [4db0f2e]
- Updated dependencies [c1aa1f6]
- Updated dependencies [2432ce3]
- Updated dependencies [9b1ff50]
  - @weasel-js/core@1.8.0
  - @weasel-js/geom@1.8.0

## 1.7.3

### Patch Changes

- @weasel-js/core@1.7.3
  - @weasel-js/geom@1.7.3

## 1.7.2

### Patch Changes

- Updated dependencies [06ee1e6]
- Updated dependencies [88e298e]
- Updated dependencies [0756a82]
- Updated dependencies [b18ef4a]
  - @weasel-js/core@1.7.2
  - @weasel-js/geom@1.7.2

## 1.7.1

### Patch Changes

- e2f1968: New package `@weasel-js/guides`: placement aids, built on top of core. It holds what used to be core's grid, guide and layout-strategy code:
  
  - the grid: `createGridLayer`, `createCellHighlightLayer`, `useGridCellHover`, `roundToCell`, `gridSnapStrategy`, `pointToGridCell`;
  - guides and alignment: `useGuides`, `createGuidesLayer`, `guideSnapStrategy`, `DEFAULT_GUIDE_TOLERANCE_PX`, `deriveAlignmentGuides`, `matchAlignment`, `MOVE_ANCHORS`, `alignMoveBehavior`, `alignResizeBehavior`, `alignInsertBehavior`, and the `Guide` type;
  - snap behaviors: `snapToGrid` and `snapToGuides` from `@weasel-js/guides/move`, `/resize` and `/insert`, and `pointSnapToGrid` from the root or `/resize`;
  - layout strategies: `freeform`, `tileGrid`, `snapPoint`, and the drop-target pickers `none`, `nearest`, `nearestWithin`, `containedThenNearest` and `cellAt`.
  
  Breaking for `@weasel-js/core`. Core no longer exports any of those names, and does not re-export them, so import them from `@weasel-js/guides` instead. The `@weasel-js/core/insert` subpath is gone, since everything it held moved. `@weasel-js/core/move` keeps `snapToContainer` and `snapBackOrDelete`, and `@weasel-js/core/resize` keeps `clampMinSize` and `lockAspectWithModifier`.
  
  The canvas's `grid` layer slot now takes a pre-built layer, like `cellHighlight` and any custom slot, instead of grid options. `GridSlotConfig` and the `grid.highlight` sub-option are gone. Write `layers={{ grid: { layer: createGridLayer({ spacing: 20, bounds }) } }}`, and pass a cell highlight as `cellHighlight: { layer: createCellHighlightLayer(...) }`.
  
  Core keeps the seams the package plugs into: the `SnapStrategy`, `MoveBehavior`, `BoundsConstraint`, `InsertBehavior` and `PointSnap*` types, `snap()`, `OriginProjection` with `RECT_ORIGIN_PROJECTION`, the `snap` dep, `selectTool.snap`, `toolOptions.snapPoint`, and the `LayoutStrategy` contract. It now also exports `AUTO_ORIGIN_PROJECTION`, the default projection for rects and paths, and three helpers for writing a snap behavior: `screenTolerance`, which converts a screen-pixel tolerance to world units through the gesture's camera; `gestureViewReader`, which reads that camera; and `gesturePlaneReader`, which reads the parallax plane being edited.
- 9118aea: Alignment guides gain equal-spacing snaps and Figma-style segments. Additive,
  with one visible default change.
  
  - `matchSpacing` and `measureGaps` snap a box so its gap to a neighbor in its
    row or column equals a gap already between two other boxes, or center it
    between its two neighbors. Pass `getSpacingTargets` (sibling bounds) and
    `setActiveGaps` to `alignMoveBehavior` or `alignResizeBehavior` to turn it
    on; on each axis the nearer of the alignment and spacing snaps wins.
  - `Guide` has an optional `span`, the stretch of the line worth drawing.
    `deriveAlignmentGuides` fills it with the extent of the boxes behind each
    line, and `matchAlignment` stretches it to reach the snapped box.
  - `createGuidesLayer` draws a spanned guide as a segment with end ticks, and
    draws `getGaps` as ticked, size-labeled gap markers (`ticks`, `gapLabels`,
    `gapColor`). Derived alignment guides therefore render as segments by
    default now; `extent: 'full'` restores canvas-long lines. Guides with no
    span, such as user-placed ones, still draw across the canvas.
- 9f83b33: A grown `tileGrid({ overflow: 'grow' })` shrinks back when children leave it. Deleting a child, or moving or dragging one out, gives back each line of cells that empties — never below the declared `rows` (or `cols` for `flow: 'column'`) — and the rest keep their cell size instead of stretching over the grown container. The shrink lands in the same undo step as the departure.
  
  This rides on a new optional `LayoutStrategy.depart(container, children, departed)`: the scene's layout pass hands it the children that stay and the ids that left, and it returns poses plus optional new container bounds, as `arrive` does. An edit that both removes and adds children runs `depart` first, then `arrive`. `SceneArrivalHandler` gains a third argument, `departures`, the nodes each container lost in the edit; `layoutArrivalHandler` and `useLayoutArrivals` pass it through. Additive: a strategy without `depart` is rearranged by `childPoses`, as before.
- 6f03bf7: A container can declare its layout on the scene: `scene.add({ kind: 'container',
  layout: tileGrid(...) })`, or `layoutKey` in a snapshot, resolved through the new
  `SceneRegistry.layout`. Layouts now answer to every change to a container's
  children, not only arrivals: a delete, reorder or resize re-runs the strategy's
  `childPoses`, and the writes land in the same undo step as the change, so undo
  restores the whole arrangement at once. A child that joins goes to `arrive` as
  before, and to `childPoses` when the strategy has no `arrive`.
  
  This runs through the scene's existing arrival window and `arrange` op; there is
  one layout pass (`core/scene/layoutPass.ts`) whether the layout is declared on
  the node or supplied by `<SceneCanvas layouts>` / `useLayoutArrivals`, and a
  declared layout wins. With no handler installed, a scene holding declared
  layouts runs that pass itself, measured by the new
  `UseSceneOptions.layoutFrame` (also a `sceneFromJSON` option).
  
  Breaking edges: `SceneArrivalHandler` gains a second argument, `changed`, and is
  now also called for edits with no arrivals. While layouts are active, a bare
  `scene.remove`, `scene.reorder`, or a `setPose` that resizes a container is
  recorded as a one-mutation batch, like `add` and `move` already were. The
  `arrange` op's coalesce key now names the nodes it moved.
  
  Also new: `scene.layoutOf(id)` and `scene.onReflow(listener)`, which reports each
  live edit's layout writes; `<SceneCanvas reflowTransition>` uses it to glide
  those reflows as it does a drag's. New exports: `LayoutFrame`, `LayoutMove`.
- 43ad590: `tileGrid` takes an `overflow` policy, and it holds however a child arrives — dragged in, inserted, reparented, duplicated or grouped inside the grid. Before, only a drop was checked: a child that arrived by an op past `cols * rows` was skipped by the layout and left wherever its pose put it.
  
  - `'reject'` (the default) refuses the child by every route. A drop finds no free cell, as before. An insert or reparent that would overfill the grid is now reverted whole, so nothing lands and no undo entry is recorded. **This is a behavior change:** such an op used to add the child and leave it unplaced.
  - `'grow'` adds a row when the last one fills (a column, under `flow: 'column'`), and the container grows by one cell pitch to hold it, in the same undo step.
  - `'scroll'` keeps the container's size and runs the extra children on past its last visible row at the same pitch. `LayoutStrategy.contentExtent` reports the region they cover.
  
  Also new on `tileGrid`: `flow: 'row' | 'column'` sets the fill order. Every child now gets a cell from `childPoses`; one past the grid is placed past it rather than skipped. A child that joins a non-full grid by an op is placed in the free cell nearest to where it was put. Before, it stayed where its pose put it.
  
  Underneath, the scene has an arrival hook. `scene.setArrivalHandler(fn)` hears every node that joins a container during one live edit. It returns poses to write as part of that edit, or `null` to refuse the edit. A refused `applyBatch` (or `history.applyOps`, or a journal's `applyBatch`) is reverted and does not throw. A refused `scene.batch`, `untracked`, or bare `add` / `move` is reverted and throws `SceneArrivalRefused`. Redo and a restored history replay the arrangement recorded the first time, through the new `'arrange'` op (`createArrangeOp`). `LayoutStrategy` gains the optional `arrive` and `contentExtent`. `layoutArrivalHandler(scene, { layouts })` connects a scene's layouts to the hook, and `<SceneCanvas layouts>` installs it. A canvas wired by hand through `sceneToAdapter({ layouts })` calls `useLayoutArrivals`. A reparent-on-drop the container refuses now leaves the drag uncommitted instead of throwing.
  
  Mostly additive, with these breaking edges. The default-policy change above. `Scene` gains a required `setArrivalHandler`, so a hand-written `Scene` implementation has to add it. While a handler is installed, a bare `scene.add` / `scene.move` into a container is recorded as a one-mutation batch.
- Updated dependencies [6f59206]
- Updated dependencies [716ea36]
- Updated dependencies [2d7003a]
- Updated dependencies [e17fe2c]
- Updated dependencies [f457e7c]
- Updated dependencies [8635031]
- Updated dependencies [276bad1]
- Updated dependencies [efc5727]
- Updated dependencies [108551d]
- Updated dependencies [a5bc201]
- Updated dependencies [4e18c9f]
- Updated dependencies [112c781]
- Updated dependencies [ac2e76e]
- Updated dependencies [9c164e2]
- Updated dependencies [85d62a7]
- Updated dependencies [dfd926f]
- Updated dependencies [3d80c9f]
- Updated dependencies [a1ecaac]
- Updated dependencies [886fefd]
- Updated dependencies [04b0b96]
- Updated dependencies [27bcf57]
- Updated dependencies [a7f2103]
- Updated dependencies [b2fd89a]
- Updated dependencies [4212d2d]
- Updated dependencies [12263bc]
- Updated dependencies [b5cc59f]
- Updated dependencies [e2f1968]
- Updated dependencies [1524403]
- Updated dependencies [bfc4b21]
- Updated dependencies [f046160]
- Updated dependencies [9f83b33]
- Updated dependencies [3c1def2]
- Updated dependencies [ae6e8ac]
- Updated dependencies [4b570e5]
- Updated dependencies [251fb64]
- Updated dependencies [9bfdda9]
- Updated dependencies [b554ee0]
- Updated dependencies [702829d]
- Updated dependencies [9cad63b]
- Updated dependencies [b228015]
- Updated dependencies [53cdd41]
- Updated dependencies [33b7ac2]
- Updated dependencies [fa67cbf]
- Updated dependencies [8f68fa8]
- Updated dependencies [25448ee]
- Updated dependencies [88c1ae3]
- Updated dependencies [dcc9834]
- Updated dependencies [365c762]
- Updated dependencies [941e941]
- Updated dependencies [b20df31]
- Updated dependencies [55ef61f]
- Updated dependencies [712de19]
- Updated dependencies [67d95c8]
- Updated dependencies [8a68b6c]
- Updated dependencies [16a0476]
- Updated dependencies [6f03bf7]
- Updated dependencies [72379f6]
- Updated dependencies [7f7d153]
- Updated dependencies [d9cdff1]
- Updated dependencies [63d0ece]
- Updated dependencies [f8bde12]
- Updated dependencies [685a086]
- Updated dependencies [90a4686]
- Updated dependencies [7e08265]
- Updated dependencies [d60a422]
- Updated dependencies [dde2315]
- Updated dependencies [4cb55b7]
- Updated dependencies [fb21799]
- Updated dependencies [fe9a91e]
- Updated dependencies [3a68365]
- Updated dependencies [43ad590]
- Updated dependencies [4cef954]
- Updated dependencies [c4cc60f]
- Updated dependencies [6df279e]
- Updated dependencies [09ff2c1]
- Updated dependencies [637945e]
- Updated dependencies [5308126]
  - @weasel-js/core@1.7.1
  - @weasel-js/geom@1.7.1
