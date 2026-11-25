# Audit round 49 — guides.grid (reviewer findings)

## Unscoped grids resolve a tagged pitch with the unit's offset; scoped grids subtract it
- where: packages/guides/src/grid/reading.ts:37 (gridLines), vs reading.ts:21 (span)
- scenario: a `UnitSystem` entry is affine (`base = value * factor + offset`, packages/quantity/src/units.ts:13-26). With `scopes`, every grid length goes through `span()`, which subtracts the resolution of zero, so `{ value: 1, unit: 'u' }` with `{ factor: 10, offset: 5 }` gives a pitch of 10. Without `scopes`, `gridLines` calls `resolveUnit` straight, so the same spacing gives a pitch of 15, and `offset`/`from`/`to`/`at` all move by 5 as well. The same `spacing` and unit table give two different lattices depending only on whether `scopes` was passed, and the unscoped one is wrong for the pitch (a pitch is a length, so it should be 10). `createGridLayer`, `gridSnapSource` and `pointToGridCell` all share this path, so they agree with each other, but disagree with their own scoped mode. The comment on `span` ("a unit that disagrees about zero moves them nowhere") states the rule that the unscoped branch doesn't follow.
- evidence: read
- severity: medium

## With `bounds`, the grid layer emits every line across the bounds, not just the visible part
- where: packages/guides/src/grid/layer.ts:90-94 (createGridLayer draw), packages/guides/src/grid/lattice.ts:64-68 (periodic)
- scenario: `bounds` is used as given, and nothing intersects it with `viewportWorldRect`. `periodic` only drops a family when its step is under 4 screen pixels, so the line count is `span / step` over the whole bounds. Example: `bounds` = a 100 000 × 100 000 world page, `spacing: 1`, `subdivisions: 4`, zoomed in to scale 8 (a step of 0.25 is 2 px; cells are 8 px, so cell lines draw). That is 200 000 path commands per paint, each with its own `Uint8Array`/`Float32Array`, while the canvas shows a few hundred. Zooming in raises the count until every subdivision is drawn, all of it offscreen. Without `bounds` the padded viewport keeps the count to what is on screen, so the cost depends on an option that only means to say where the grid stops. The fix is to clip `b` to the padded viewport for drawing, keeping `b`'s corner as the anchor.
- evidence: read
- severity: medium

## Grid line and clip coordinates are written as world-space Float32, so lines far from the origin snap to float32 steps
- where: packages/guides/src/grid/lattice.ts:53-55 (draw), packages/guides/src/grid/layer.ts:148 (withHoles)
- scenario: each line's endpoints are absolute world coordinates in a `Float32Array`. Near world x = 1e6 a float32 step is 0.0625. With `spacing: 0.01` at view scale 1000 (10 px per cell, so cell lines draw), the f64 positions from `linesIn` land on float32 values about 6 lines apart. The drawn lines bunch onto the same x, with 62 px gaps between bunches, while `gridSnapSource` and `pointToGridCell` (f64) snap and highlight between them. The 2^53 rule in docs/unruled.md:1722 covers step indices, not this. Writing the lines relative to a nearby anchor and carrying it in the group's transform would keep them in place.
- evidence: read
- severity: low

## useGridCellHover keeps a stale cell when the view, spacing or regions change without a pointer move
- where: packages/guides/src/grid/useGridCellHover.ts:89-95 (onMove), :108 (effect deps)
- scenario: the cell is computed only in `pointermove`. If you hover a cell and then wheel-zoom or keyboard-pan (no pointermove fires), or the app changes `spacing`/`regions` (a grid-size pref), `getCell()` still returns the old cell's box. `createCellHighlightLayer` keeps filling a cell that is no longer under the cursor, or one sized for the old grid, until the mouse moves. The hook's doc says `view` is read "so it can reflect live pan/zoom", but nothing recomputes on pan/zoom. The effect also binds to `opts.ref.current` only when `enabled` or the ref object changes, so if the ref is reattached to a new element (remount under the same ref), listeners stay on the detached old element.
- evidence: read
- severity: low

## sceneGridRegions builds its child lists by copying the array for every node, quadratic in sibling containers, on every paint and pointermove
- where: packages/guides/src/grid/regions.ts:66-71 (sceneGridRegions)
- scenario: `children.set(parent, [...(children.get(parent) ?? []), id])` copies the sibling list once per owning node. With `GridOwners.root` set and 5 000 unit-scoped groups under the root, that is about 12.5 M element copies per call. `GridLayerOptions.regions` and `UseGridCellHoverOptions.regions` are documented as read every paint and every pointermove, and `sceneGridRegions` is what they are told to call, so the cost lands on every frame. A `push` on the existing array makes it linear.
- evidence: read
- severity: low

## Files read
packages/guides/src/grid/axes.ts
packages/guides/src/grid/cellHighlight.ts
packages/guides/src/grid/fit.ts
packages/guides/src/grid/index.ts
packages/guides/src/grid/lattice.ts
packages/guides/src/grid/layer.ts
packages/guides/src/grid/pointToGridCell.ts
packages/guides/src/grid/preset.ts
packages/guides/src/grid/reading.ts
packages/guides/src/grid/regions.ts
packages/guides/src/grid/roundToCell.ts
packages/guides/src/grid/useGridCellHover.ts

<!-- done: 5 findings, files read: 12 -->
