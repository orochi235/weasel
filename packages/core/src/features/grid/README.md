# grid

World-space grid rendering, cell hover tracking, and cell-snap helpers.

## Two levels of API

**`useGridFeature`** is the one-call entry point. It returns the
role-taxonomy shape `{ api, attrs, layers }` — wire those three into your
canvas and you have a grid with hover highlighting.

The low-level primitives it composes stay exported for cases the feature hook
doesn't cover:

| File | Role |
| --- | --- |
| `layer.ts` | `createGridLayer` — draws the grid: base spacing, optional finer subdivisions, accent lines every N cells. |
| `cellHighlight.ts` | `createCellHighlightLayer` — highlights one cell (snap-target preview). Stack alongside the grid layer. |
| `useGridCellHover.ts` | Pointer → hovered cell tracking. |
| `roundToCell.ts` | Scalar quantizer. |

> `useGridFeature` is the **migration test for the feature-roles taxonomy** —
> see `docs/TODO.md` → "Feature-roles taxonomy". If you're adding another
> feature in that shape, read this one first; changes to the taxonomy should
> land here before they're copied elsewhere.

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

Cell snapping during gestures lives in the gesture strategies
(`interactions/gestures/shared/strategies/grid`), not here — this module owns
drawing and hover. `useGridCellHover` calls into `pointToGridCell` from there,
so the two agree on where cell boundaries are.
