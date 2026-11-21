# Audit round 63, area `pdf` — blind reviewer

Note: commit 1b4edb3a93db1759496d564da57eb13020b3d7d2 is not in this repository; `packages/pdf` was read at
HEAD 6f634fabe1, where it has no working-tree changes.

## A `{ px }` stroke under a transform that stretches one axis more than another is written with one local width, so its thickness varies with direction
- where: packages/pdf/src/strokeOps.ts:46 (resolveStroke), :55 (writeNative), :109 (writeStroke); packages/pdf/src/textSegment.ts:257 (writeSegment)
- scenario: a path with `stroke: { width: { px: 2 } }` inside a group with transform scale(1, 4). The renderer's
  `drawPathStroke` takes `spaces.ribbon.metric` from `resolveStrokeLengths` and builds the ribbon (and the
  heads, `cachedMarkerHeads(..., spaces)`) in the transform's stretch, so the line is the same thickness on
  screen across, down, and on every diagonal ("exact across, down and on every diagonal rather than right only on
  average"). `resolveStroke` keeps only `cmd.stroke` and throws `spaces` away; `writeNative` writes `w <width>` in
  the group's local frame, which the PDF CTM then stretches 4x vertically, so horizontal runs come out four times
  thicker than vertical ones. The outlined path (`strokeToPath(path, stroke)`) and the marker heads
  (`markerDrawCommands(..., undefined)`) drop the metric too, and so does glyph stroking via `resolveStroke(box, …)`.
  The renderer draws a uniform hairline; the PDF draws a different shape. A native stroke should go to the outline
  path (built with the metric) whenever `spaces.ribbon?.metric` is set, or the metric should go to `strokeToPath`.
- evidence: read (renderer/src/strokeLengths.ts:29-66, renderer/src/draw/pathPaint.ts:116-139)
- severity: medium

## Opacity outside 0..1 is written to an ExtGState's /ca and /CA as given
- where: packages/pdf/src/resources.ts:19 (extGState); callers drawCommands.ts:93,111-114, images.ts:156, strokeOps.ts:63, textSegment.ts:280, groupOps.ts:157
- scenario: a solid paint `{ color: 'red', opacity: 1.5 }` (or a group `alpha: 2`, a sprite opacity of -0.2, an image
  `opacity: 3`). `solidColor` multiplies it into `alpha`, `setAlpha` calls `extGState(1.5, 1.5)`, which only checks
  finiteness, and the page's resources carry `/ca 1.5 /CA 1.5`. ISO 32000 gives both the range 0.0–1.0; the
  package's own `pdfCheck.fixture.ts` rejects such a file (`inUnit` on `/ca`, `/CA`). The renderer's output is
  clamped by the framebuffer. The value should be clamped to 0..1 where it is written.
- evidence: read
- severity: low

## A text command dropped for a non-finite number still decides the document's /Lang
- where: packages/pdf/src/textOps.ts:141 (writeText); packages/pdf/src/drawCommands.ts:168-175 (writeOne)
- scenario: every text on the pages has `lang: 'fr'` except one `lang: 'de'` text whose `y` is NaN (or whose
  stroke dash offset is NaN). `writeText` adds `'de'` to `ctx.langs` before `writeSegment` throws
  `NonFiniteNumber`; `writeOne` rolls back the content stream, the objects and the skips, but not `ctx.langs`. With
  no `opts.lang`, `writePages` then sees two languages and writes no catalog `/Lang`, although every run of text
  the file holds is French. Rollback should restore `langs` (record a run's language only once it is written, or
  snapshot and restore the set in `writeOne`).
- evidence: read
- severity: low

## An isolated group's color matrix is applied to each child, not to the finished surface, so one that scales alpha fades overlaps unevenly
- where: packages/pdf/src/groupOps.ts:131-140 (isolatedGroup), :172-177 (writeGroup)
- scenario: a group `{ isolate: true, colorMatrix: <identity with m[18] = 0.5> }` (a CSS `opacity(0.5)` filter as a
  matrix) holding two overlapping opaque rects. `GroupDrawCommand.isolate` says "`alpha` and `colorMatrix` then
  apply to the finished surface, so overlapping children do not show through each other", and the renderer does
  that. `writeGroup` composes `cmd.colorMatrix` into `inner.colorMatrix` and `isolatedGroup` hands `inner` to
  `writeCommands`, so each rect is written at alpha 0.5 inside the form and the overlap composites to 0.75 while
  the rest is 0.5. Only `inner.alpha` is lifted onto the form; the only matrix case reported is an alpha offset
  (`colorMatrix[19]`). The same holds for any row that reads alpha or any clamp the per-child fold hits first.
  `rasterGroup` (the effects path) gets this right by folding the finished raster through the matrix.
- evidence: read (renderer/src/DrawCommand.ts:77-84)
- severity: medium

## Whether runs share a language is decided case-sensitively in one place and case-insensitively in another
- where: packages/pdf/src/writePdf.ts:142 (writePages); packages/pdf/src/textOps.ts:142 (writeText)
- scenario: no `opts.lang`; one text has `lang: 'en-US'`, another `lang: 'en-us'` (BCP 47 tags are
  case-insensitive). `writeText` compares a run's tag to the document's with `toLowerCase()`, but `writePages`
  takes the shared language from `langs.size === 1` over the tags as written, so the set holds two entries and the
  catalog gets no `/Lang`, and every run is then marked with its own `/Span /Lang`, although every run is the
  same language. The set should hold normalized tags (or the shared check compare them lowercased).
- evidence: read
- severity: low

## An image or sprite `source` rect reaching past the bitmap leaves that part blank where the renderer smears the edge
- where: packages/pdf/src/images.ts:139-161 (place)
- scenario: an `image` command with `source: { x: -4, y: 0, width: 20, height: 16 }` on a 16x16 bitmap.
  `ImageDrawCommand.source` says a rect past the edge "samples outside [0..1], which CLAMP_TO_EDGE smears", so the
  renderer fills the whole destination rect, the left quarter with the first column repeated. `place` clips to the
  destination and maps the bitmap so `source` fills it, so the left 4/20 of the rect has no bitmap under it and is
  left unpainted in the PDF. The same for a sprite whose `sx, sy, sw, sh` reach past the atlas. The source rect
  should be clamped to the bitmap (shrinking the destination to match) or the edge pixels extended.
- evidence: read (renderer/src/DrawCommand.ts:231-238)
- severity: low

## Paint opacity is applied after the group color matrix, where the renderer folds it into alpha before the matrix
- where: packages/pdf/src/color.ts:26-29 (solidColor); packages/pdf/src/shading.ts:50-54 (paintShading); packages/pdf/src/drawCommands.ts:93 (writeTextureFill)
- scenario: a group with `colorMatrix` = identity plus alpha bias `m[19] = 0.5` (or alpha scale `m[18] = 2`) holding
  a path filled `{ color: '#f00', opacity: 0.2 }`. The renderer puts opacity into alpha first and then runs the
  matrix: batch.ts:177 `foldColorInto(..., c[3] * (paint.opacity ?? 1))`, and gradFill.ts:62-66 says so outright
  ("Fill opacity into the alpha channel before the matrix ... The two have to agree"), giving
  `clamp(0.2 + 0.5) = 0.7`. `solidColor` folds the color's own alpha through the matrix (`clamp(1 + 0.5) = 1`) and
  multiplies opacity in afterwards, writing `/ca 0.2`. With `m[18] = 2` the renderer draws alpha 1 and the PDF 0.5.
  Gradients do the same (`alpha = opacity * state.alpha` times the folded stops' alpha), and so does any matrix
  whose rgb rows read alpha. The fold should take `[r, g, b, a * opacity]`.
- evidence: read (renderer/src/draw/batch.ts:166-177, renderer/src/shaders/gradFill.ts:62-68)
- severity: medium

## Files read
packages/pdf/src/color.ts
packages/pdf/src/content.ts
packages/pdf/src/deflate.ts
packages/pdf/src/drawCommands.ts
packages/pdf/src/export.ts
packages/pdf/src/fonts/embedFont.ts
packages/pdf/src/fonts/fontSource.ts
packages/pdf/src/fonts/subset.ts
packages/pdf/src/fonts/toUnicode.ts
packages/pdf/src/groupOps.ts
packages/pdf/src/images.ts
packages/pdf/src/index.ts
packages/pdf/src/latin1.ts
packages/pdf/src/num.ts
packages/pdf/src/objects.ts
packages/pdf/src/pathOps.ts
packages/pdf/src/pbt.fixture.ts
packages/pdf/src/pdfCheck.fixture.ts
packages/pdf/src/pdfReader.fixture.ts
packages/pdf/src/regionsPdf.ts
packages/pdf/src/resources.ts
packages/pdf/src/shading.ts
packages/pdf/src/strokeOps.ts
packages/pdf/src/testing/noFonts.ts
packages/pdf/src/textOps.ts
packages/pdf/src/textOutlines.ts
packages/pdf/src/textSegment.ts
packages/pdf/src/writePdf.ts

<!-- done: 7 findings, files read: 28 -->
