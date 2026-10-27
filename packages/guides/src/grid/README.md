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

## Bounds

`bounds` is optional. Omitted, the grid covers the visible world rect each
paint, its lines on world multiples of `spacing` so they hold still as the
view pans. Given, it is called with the paint's `(view, dims)`, and lines
start at its own corner.

A line family — subdivisions, cell lines, accents — is left out on an axis
once it would sit closer than 4px on screen, so zooming out thins the grid to
accents alone and then to nothing.

## Units

`spacing` accepts a bare number (world units) or a tagged `{ value, unit }`.
**Tagged values require `unitSystem` to be supplied** — passing a tagged
spacing without one is a configuration error, not a silent fallback.

Given `scopes` (a `GridScopes`), every grid reader takes its pitch from the
unit scope it sits in, through `gridPitch`. The grid layer and
`useGridCellHover` also take `regions`: the containers declaring a scope, each
a world outline and its scope chain, nested as the containers are.
`sceneGridRegions` builds them from a scene. The layer draws each region's
lattice clipped to its outline and cuts it out of the lattice around it, and a
hovered cell carries the `pitch` of the lattice it is on, which
`createCellHighlightLayer` draws it at. A region's `frame` is the container's
box frame (`sceneBoxFrames`): its lattice runs from the container's corner
along its axes, and turns with it, and a cell in it is counted and drawn in
that frame. `gridSnapSource` rounds in the same frame, read through
`SnapCollect.frameOf`. A region with no `frame` stays world-aligned, through
the root lattice's anchor.

## Related

Snapping to the grid during gestures is `gridSnapSource`
(`../sources/grid.ts`), not here — this module owns drawing and hover, and
`pointToGridCell`, which `useGridCellHover` uses to find the cell under the
pointer.
