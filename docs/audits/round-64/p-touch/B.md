## A justified text box drops its `align`, which the canvas uses for every line it does not spread
- where: packages/p-touch/src/lbx/shapes.ts:154 (textObject)
- scenario: a `TextDrawCommand` with `justify: true` and `align: 'center'` (or `'right'`/`'end'`). The layout spreads only lines that wrapped; a line closing its paragraph, and every line when `maxWidth` is infinite, keeps `align` (`packages/text/src/layout/layoutOpts.ts:26-31`: "`align` is CSS `text-align-last` here"). So a one-line justified, centered box draws centered on the canvas. `textObject` computes `align = cmd.justify ? 'justify' : …`, throws `cmd.align` away and writes `horizontalAlignment: 'JUSTIFY'`, which P-touch draws starting at the left (inferred: a justified paragraph's last line sits at the start in P-touch, as in every Windows text engine). The box should be rasterized, or written with `cmd.align`'s alignment when no line is spread, whenever `justify` is set with an `align` other than `left`/`start`/`justify`.
- evidence: read
- severity: medium

## Under auto length, a polyline whose stroke reaches past the label's end is still written as an object
- where: packages/p-touch/src/lbx/writeLbx.ts:113 (withinLength), packages/p-touch/src/lbx/shapes.ts:101 (lineObject)
- scenario: `autoLength: true`, `length: 100`, and an open polyline from (10, 5) to (100, 5) stroked 6 wide with round caps, or a vertical butt-capped line at x = 99 stroked 4 wide. `withinLength` checks `position`, and `lineObject` sets `position` to the bounding box of the points alone, leaving out the stroke's half-width and round caps. So the line passes, is written as a `draw:poly`, and P-touch draws (and can grow the label for) the 3pt cap past the end, while the raster drawn next to it is cropped at x = 100. `rectObject` grows its position by the stroke (shapes.ts:32), so a rect with the same overhang is rasterized. The ruling (docs/unruled.md, 2026-11-20, audit round 53) says a shape reaching past either end is rasterized; for a line the check should include the stroke's reach (width / 2 across, plus width / 2 along at round caps).
- evidence: read
- severity: low

## `sceneToLbx` accepts `pixelRatio` and `screen` but drops the screen space the plan was made for
- where: packages/p-touch/src/lbx/sceneLbx.ts:39 (sceneToLbx)
- scenario: `SceneToLbxArgs` leaves `pixelRatio`, `screen` and `flattenTolerancePx` in (it omits only `sourceRect`, `scale`, `background`, `gl`, `createCanvas`). With `pixelRatio: 2`, `planPixelRender` builds the scene under a CSS view and wraps it in a ×2 group, and returns `plan.screen` so that `'screen'`-unit paint resolves at that density (`packages/core/src/canvas/renderSceneToPixels.ts:84-87`). `sceneToLbx` reads only `{ commands, view }`, and `commandRasterizer` renders with `screen: toPixels`. So a caller passing `pixelRatio`, or their own `screen`, gets screen-unit gradients and `{ px }` lengths drawn at a different size from `renderLabel` with the same arguments; `flattenTolerancePx` is also silently ignored. These should be omitted from the type or carried through.
- evidence: read
- severity: low

## An auto-length label longer than P-touch's 1000 mm ceiling is written without complaint
- where: packages/p-touch/src/lbx/writeLbx.ts:241-258 (lbxConfig)
- scenario: `writeLbx({ length: 3000, autoLength: true, … })`. The paper's height is set to `AUTO_LENGTH_MAX_PT` (2834.4pt, the ceiling) while `backgroundFor(paper, 3000)` writes a band 3000pt long. Objects and rasters past 2834.4pt are written, so the file describes a label longer than the paper it names (inferred: P-touch caps or rejects it). `lbxConfig` validates `length` as positive and finite but not against the ceiling under auto length; it should throw a `RangeError`, as it does for a non-finite length, or clamp and report.
- evidence: read
- severity: low

## Files read
packages/p-touch/src/index.ts
packages/p-touch/src/lbx/carried.ts
packages/p-touch/src/lbx/sceneLbx.ts
packages/p-touch/src/lbx/shapes.ts
packages/p-touch/src/lbx/style.ts
packages/p-touch/src/lbx/writeLbx.ts
packages/p-touch/src/pbt.fixture.ts
packages/p-touch/src/print.ts
packages/p-touch/src/render.ts
packages/p-touch/src/tape.ts

<!-- done: 4 findings, files read: 10 -->
