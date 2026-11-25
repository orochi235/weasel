# Findings: guides.grid (round 49)

## Grid lines and clip outlines are written as absolute world coordinates in a Float32Array with no `origin`, so they land off their positions far from world zero
- where: packages/guides/src/grid/lattice.ts:55 (lattice → draw); packages/guides/src/grid/layer.ts:148 (withHoles)
- scenario: a grid of pitch 0.01 viewed at scale 200 around world x = 1,000,000. `draw` builds each line as `new Float32Array([p, lo, p, hi])`; float32 at 1e6 resolves to 0.0625, so neighboring lines 0.01 apart collapse onto the same float and every drawn line is off its true position by up to 0.03 world units (about 6 px at that zoom), while snapping (`gridSnapSource`, doubles) puts nodes on the true lines, so nodes visibly sit off the drawn grid. `withHoles` stores region outlines the same way, so the clip edge drifts from the container too. `PolygonPath.origin` (packages/geom/src/path.ts, "a float32 coordinate at 262,144 is on a 1/32 grid; one measured from an origin beside the shape keeps its fraction") exists for exactly this; neither path sets it. This is not the ruled 2^53 case in docs/unruled.md (indices past a safe integer); it bites at ~2^18.
- evidence: read
- severity: medium

## Without `scopes`, a tagged grid length is read with its unit's offset, so a unit with an affine offset moves the pitch; with `scopes` the same length is read offset-free
- where: packages/guides/src/grid/reading.ts:37 (gridLines), vs reading.ts:21–24 (span)
- scenario: a unit system whose entry has an `offset` (units.ts allows `base = value * factor + offset`), e.g. x axis `{ day: { factor: 86400, offset: 1.7e9 } }`, and `spacing: { x: { value: 1, unit: 'day' } }`. Unscoped, `resolveUnit` returns 86400 + 1.7e9 as the pitch (and adds the offset to `offset`, `from`, `to` and every `at` entry), so the grid draws and snaps on a pitch of ~1.7e9. Passing the same system as `scopes.root` goes through `span`, which subtracts the zero's value, and gives the intended 86400. The doc on `span` says grid lengths are measured from the origin so "a unit that disagrees about zero moves them nowhere"; the unscoped branch answers that question the other way. Every reader (layer, pointToGridCell, gridSnapSource) goes through this one function, so all of them get the wrong pitch.
- evidence: read
- severity: medium

## A NaN or infinite `offset` passes validation and `cellOf` returns a cell of NaNs instead of `null`
- where: packages/guides/src/grid/axes.ts:79 (periodic), axes.ts:136–147 (cellOf)
- scenario: `{ x: { pitch: 10, offset: NaN } }` (or a tagged offset that resolves to NaN/Infinity). `periodic` checks pitch and `from <= to` but not `offset`, so the axis resolves with no warning. `indexRange` gives `[NaN, NaN]`; in `cellOf`, `k` is NaN and both `k < lo` and `k >= hi` are false, so it returns `{ index: NaN, lo: NaN, hi: NaN }` rather than `null`. `pointToGridCell` then returns a non-null cell with a NaN box; in `useGridCellHover`, `cellsEqual` compares NaN to NaN as unequal, so every pointermove calls `setCell` and `onChange`, re-rendering on each pointer tick. `linesNear`/`linesIn` return nothing for the same axis, so the drawn grid and the cell disagree about whether the axis has lines. It should be invalid like a bad pitch (warning, no lines).
- evidence: read
- severity: low

## `useGridCellHover` reads `ref.current` once per effect run, so an element attached after mount, or swapped for another, never gets listeners
- where: packages/guides/src/grid/useGridCellHover.ts:77–108 (useGridCellHover)
- scenario: the hook is called in a component whose canvas is rendered conditionally or by a child that mounts later (e.g. after a Suspense boundary resolves, or behind a `ready` flag). On the first effect run `opts.ref.current` is null and the effect returns; its deps (`enabled`, the stable ref object, `optsRef`) never change, so it never re-runs and hover never tracks. Likewise when the element behind the ref is replaced (a `key` change remounting the canvas), the listeners stay on the detached old element and the new one gets none.
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

<!-- done: 4 findings, files read: 12 -->
