# Audit round 31 — parallax

## A bare-number `bleed` widens only the x axis, so a lattice tiled on both axes pops content in at its top and bottom edges
- where: packages/parallax/src/createTiledLayer.ts:90 (createTiledLayer draw → `axes(bleed, 0)`), with :41 (axes)
- scenario: `createTiledLayer({ period: { x: 500, y: 500 }, bleed: 200, … })`. `axes(200, 0)` gives `{ x: 200, y: 0 }`, so on y the range is not widened at all: content overhanging its cell by up to 200 on y pops in at the view's top or bottom edge instead of scrolling in, which is exactly what `bleed` exists to prevent. `axes` gives a bare number "x only" because that is right for `TilePeriod` (a side-scroller), but `TileBleed`'s doc says only "how far the content reaches outside its own cell" and says nothing about x only. `bleed: 200` should cover both axes, or the type should say it is x only. Any y period with a numeric bleed hits this.
- evidence: read
- severity: medium

## `plane.set({ pan: undefined })` makes every later draw of the parallax layer throw
- where: packages/parallax/src/createParallaxPlane.ts:25 (createParallaxPlane `set`), read at packages/parallax/src/createParallaxLayer.ts:59
- scenario: `set` takes `Partial<ParallaxOptions>`. Under `strict` without `exactOptionalPropertyTypes` (the root tsconfig) that type accepts `{ pan: undefined }`, as an animator writing `plane.set({ pan: maybe })` would produce. `{ ...current, ...patch }` puts an own `pan: undefined` over the real one, `sameOpts` sees a change and notifies, and the next draw calls `deriveParallaxView(outer, { pan: undefined })`. There `asXY(undefined)` returns `undefined` and `p.x` throws a TypeError. The layer's draw throws on every frame from then on (the canvas's layer guard reports it on each one), and the plane never recovers until `pan` is written again. `zoom: undefined` and `anchor: undefined` are harmless because `??` defaults them. `pan: undefined` should be ignored (or rejected), not stored.
- evidence: read
- severity: medium

## A y range emptied by a negative bleed lets the copy-count guard pass, and the x loop then runs once per column with nothing to draw
- where: packages/parallax/src/createTiledLayer.ts:98 (createTiledLayer draw, `tiling` guard) and :116
- scenario: the guard multiplies the two spans. When `bleed.y` is negative by more than half the visible height, so the start and end land in different cells, `tileRange` answers `to < from` on y (for example `{ from: 1, to: -1 }`, span −1). The product is then negative and passes `<= MAX_COPIES` no matter how large the x span is. The outer `for i` loop then runs `kx.to − kx.from + 1` times (millions to billions when zoomed out on a small `period.x`), each pass with an empty inner loop. That is a frame-long or multi-second stall where the cap means to draw nothing. The guard should treat an empty axis as zero copies, or test each span alone. Nothing rejects a negative `bleed`; its doc gives no sign constraint.
- evidence: read
- severity: low

## Files read
packages/parallax/src/createParallaxLayer.ts
packages/parallax/src/createParallaxPlane.ts
packages/parallax/src/createTiledLayer.ts
packages/parallax/src/index.ts
packages/parallax/src/pbt.fixture.ts
packages/parallax/src/tileRange.ts

<!-- done: 3 findings, files read: 6 -->
