---
'@weasel-js/core': patch
'@weasel-js/guides': patch
---

New package `@weasel-js/guides`: placement aids, built on top of core. It holds what used to be core's grid, guide and layout-strategy code:

- the grid: `createGridLayer`, `createCellHighlightLayer`, `useGridCellHover`, `roundToCell`, `gridSnapStrategy`, `pointToGridCell`;
- guides and alignment: `useGuides`, `createGuidesLayer`, `guideSnapStrategy`, `DEFAULT_GUIDE_TOLERANCE_PX`, `deriveAlignmentGuides`, `matchAlignment`, `MOVE_ANCHORS`, `alignMoveBehavior`, `alignResizeBehavior`, `alignInsertBehavior`, and the `Guide` type;
- snap behaviors: `snapToGrid` and `snapToGuides` from `@weasel-js/guides/move`, `/resize` and `/insert`, and `pointSnapToGrid` from the root or `/resize`;
- layout strategies: `freeform`, `tileGrid`, `snapPoint`, and the drop-target pickers `none`, `nearest`, `nearestWithin`, `containedThenNearest` and `cellAt`.

Breaking for `@weasel-js/core`. Core no longer exports any of those names, and does not re-export them, so import them from `@weasel-js/guides` instead. The `@weasel-js/core/insert` subpath is gone, since everything it held moved. `@weasel-js/core/move` keeps `snapToContainer` and `snapBackOrDelete`, and `@weasel-js/core/resize` keeps `clampMinSize` and `lockAspectWithModifier`.

The canvas's `grid` layer slot now takes a pre-built layer, like `cellHighlight` and any custom slot, instead of grid options. `GridSlotConfig` and the `grid.highlight` sub-option are gone. Write `layers={{ grid: { layer: createGridLayer({ spacing: 20, bounds }) } }}`, and pass a cell highlight as `cellHighlight: { layer: createCellHighlightLayer(...) }`.

Core keeps the seams the package plugs into: the `SnapStrategy`, `MoveBehavior`, `BoundsConstraint`, `InsertBehavior` and `PointSnap*` types, `snap()`, `OriginProjection` with `RECT_ORIGIN_PROJECTION`, the `snap` dep, `selectTool.snap`, `toolOptions.snapPoint`, and the `LayoutStrategy` contract. It now also exports `AUTO_ORIGIN_PROJECTION`, the default projection for rects and paths, and three helpers for writing a snap behavior: `screenTolerance`, which converts a screen-pixel tolerance to world units through the gesture's camera; `gestureViewReader`, which reads that camera; and `gesturePlaneReader`, which reads the parallax plane being edited.
