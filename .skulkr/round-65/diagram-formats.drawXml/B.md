# Audit round 65 — diagram-formats.drawXml

## Every container and pool is written dashed, though the diagram draws regions solid
- where: packages/diagram-formats/src/drawXml/writeStyle.ts:85 (regionStyle → colorParts → dashParts)
- scenario: write any document with a container under a built-in theme. Every theme's `container` style carries
  `dash: [4, 3]` (or `[6, 4]`) (`packages/diagram/src/theme/themes.ts:21,50,78,106,135`), and `dataRegionStyle`
  passes it through, so `regionStyle` writes `dashed=1;dashPattern=4 3;` on the swimlane. The diagram draws a
  container or pool outline with `outlineOf(style, 'region')`, which drops the dash ("a container or pool undashed,
  whatever the style says", `packages/diagram/src/dataTypes.ts:222-227`, used at `containers/regionSpecs.ts:58`).
  So a container drawn solid in weasel opens dashed in a draw app, against `writeDrawXml`'s promise that the file
  "looks the same anywhere". Lanes get the same `dashParts` from `colorParts` though `outlineOf(…, 'lane')` never
  dashes either. The writer already applies the lane-width half of that rule (`LANE_STROKE_WIDTH`) but not the
  undashed half. Should leave out `dashed`/`dashPattern` for regions and lanes, and the reader would then warn (or
  drop) a dashed swimlane's dash, which `regionColorsOf` currently reads into `colors.dash` and the diagram ignores silently.
- evidence: read
- severity: medium

## Dash lengths are read and written as absolute, but a draw app scales `dashPattern` by the stroke width
- where: packages/diagram-formats/src/drawXml/readStyle.ts:52 (dashOf); packages/diagram-formats/src/drawXml/writeStyle.ts:16 (dashParts)
- scenario: mxGraph draws a dashed stroke's `dashPattern` (and its default `3 3`) multiplied by `strokeWidth`
  unless the style sets `fixDash=1` (mxSvgCanvas2D's `createDashPattern((s.fixDash ? 1 : s.strokeWidth) * s.scale)`).
  weasel's `dash` goes straight into the stroke spec in world units (`packages/diagram/src/edgeStroke.ts:12`,
  `fromData.ts:117`). Writing a shape with the default `strokeWidth` 2 and `dash: [6, 4]` emits
  `strokeWidth=2;dashed=1;dashPattern=6 4;` with no `fixDash`, which a draw app draws as 12/8 dashes; an edge at
  the default 1.5 comes out 1.5× long. Reading `strokeWidth=3;dashed=1;dashPattern=3 3` gives `dash: [3, 3]`
  where the draw app drew 9/9. Either write `fixDash=1` (and read `fixDash` back), or divide by / multiply with
  the stroke width on each side.
- evidence: read (draw-app behavior from mxGraph's canvas source, recalled, not run)
- severity: medium

## An HTML label's table rows, list containers, `<pre>` and other block elements run together on one line
- where: packages/diagram-formats/src/drawXml/cellText.ts:12-14 (htmlText)
- scenario: only `<br>` with no attributes and `div|p|li|h1-6` break lines. A draw-app label holding
  `<table><tr><td>a</td></tr><tr><td>b</td></tr></table>` (common in pasted or "Edit → HTML" labels) reads as the
  single line `ab`; `<blockquote>`, `<pre>`, `<ul>`/`<ol>` boundaries and `<hr>` likewise; and a `<br style="…">`
  or `<br class="…">` from pasted rich text is stripped as a generic tag with no line break, so `a<br style="">b`
  reads `ab`. A browser lays every one of these out on separate lines, which the docstring says this follows.
- evidence: read
- severity: low

## A vertex's `rotation`, `flipH` and `flipV` are dropped without a warning
- where: packages/diagram-formats/src/drawXml/readPage.ts:40 (readNode); packages/diagram-formats/src/drawXml/readStyle.ts:32 (outlineOf)
- scenario: a draw-app shape styled `rotation=45;` (or a triangle with `flipV=1`) is read at its unrotated,
  unflipped box with no warning, though the reader warns for the same kind of loss when a `direction` turns a
  shape (`turnedAway`). The diagram has no rotation, so the shape opens visibly different and nothing says why.
- evidence: read (grep finds no `rotation`/`flipH`/`flipV` handling in drawXml outside the cube's written style)
- severity: low

## A swimlane holding the `container` role mark reads back as a lane when its parent is a pool
- where: packages/diagram-formats/src/drawXml/pageCells.ts:87 (classify)
- scenario: the writer's `parentsOf` claims a pool's own `members` to the pool cell (`writePage.ts:37`, which runs for
  pools as well as containers), so a container listed in a pool's `members` is written as a swimlane child of the pool
  marked `weaselRole=container`. On read, `classify` checks "parent is a pool → lane" before it reads `ROLE_KEY`, so the
  container comes back as an extra lane of the pool, and its own members become that lane's. The role mark exists so the
  shape alone does not decide this; it should be read first.
- evidence: read
- severity: low

## Files read
packages/diagram-formats/src/drawXml/cellText.ts
packages/diagram-formats/src/drawXml/cells.ts
packages/diagram-formats/src/drawXml/format.ts
packages/diagram-formats/src/drawXml/mapping.ts
packages/diagram-formats/src/drawXml/pageCells.ts
packages/diagram-formats/src/drawXml/read.ts
packages/diagram-formats/src/drawXml/readPage.ts
packages/diagram-formats/src/drawXml/readStyle.ts
packages/diagram-formats/src/drawXml/style.ts
packages/diagram-formats/src/drawXml/write.ts
packages/diagram-formats/src/drawXml/writeEdge.ts
packages/diagram-formats/src/drawXml/writePage.ts
packages/diagram-formats/src/drawXml/writeStyle.ts
packages/diagram-formats/src/drawXml/writeXml.ts

<!-- done: 5 findings, files read: 14 -->
