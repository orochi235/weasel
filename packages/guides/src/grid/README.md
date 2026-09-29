# grid

World-space grid rendering, cell hover tracking, and cell-snap helpers.

## Primitives

| File | Role |
| --- | --- |
| `layer.ts` | `createGridLayer` — draws the grid: base spacing, optional finer subdivisions, accent lines every N cells. |
| `cellHighlight.ts` | `createCellHighlightLayer` — highlights one cell (snap-target preview). Stack alongside the grid layer. |
| `useGridCellHover.ts` | Pointer → hovered cell tracking. |
| `roundToCell.ts` | Scalar quantizer. |

## World space, not screen space

`createGridLayer` renders in **world** space — it assumes the caller has
already applied the view transform. The grid therefore zooms and pans with the
content, which is what you want for a document grid and *not* what you want for
a fixed screen-space backdrop. For the latter you want a different layer.

## Units

`spacing` accepts a bare number (world units) or a tagged `{ value, unit }`.
**Tagged values require `unitSystem` to be supplied** — passing a tagged
spacing without one is a configuration error, not a silent fallback.

## Related

Cell snapping during gestures lives in the snap strategy
(`../strategies/grid.ts`), not here — this module owns drawing and hover.
`useGridCellHover` calls into `pointToGridCell` from there, so the two agree on
where cell boundaries are.
