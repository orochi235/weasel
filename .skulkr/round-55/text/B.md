# Audit round 55 — area `text` — findings

## effectiveRangeStyle drops the node's own `style.script`, so a superscripted node reports ordinary text
- where: packages/text/src/runs/effectiveRangeStyle.ts:33-38, 61-81 (effectiveRangeStyle)
- scenario: a node with `style: { script: 'super' }` and runs that name no `script`; `effectiveRangeStyle(styleAtRange(runs, 0, n), style)` returns no `script` key at all, because `script` is listed only in `OVERRIDES` (read from the range) and never seeded from `resolved.script`. The canvas draws every run as a superscript (`resolveRunsInto` reads `run.script ?? style.script`), so a toolbar driven by this reports "no script" over text that is drawn raised and shrunk. The comment says `script` "has no node-level counterpart", which stopped being true when `TextStyle.script` was added (793987a138, 2026-09-27); `lang`, the other inherited key, is seeded from `resolved.lang` two lines above.
- evidence: read
- severity: medium

## A run grammar whose delimiter is more than one UTF-16 unit is written by `runsToMarkdown` but never read by `markdownToRuns`
- where: packages/text/src/runs.ts:282-311 (markdownToRuns), packages/text/src/runs/delimiterRuns.ts:49-62 (readDelimiters)
- scenario: `RunMarker.delimiter` is a `string` and nothing checks its length. With `{ markers: [{ delimiter: '🌟', repeat: 1, flags: ['bold'] }] }`, `runsToMarkdown([{ text: 'a', bold: true }], g)` writes `🌟a🌟` (its own read-back check fails, since `readDelimiters` indexes `text[i]`, a lone surrogate, and it falls through to `fittedMarkdown`, which does not re-read), and `escapeFor` escapes a literal `🌟` as `\🌟` because it iterates by code point. `markdownToRuns` looks delimiters up by `input[i]`, one UTF-16 unit, so it reads `🌟a🌟` back as plain text and keeps the backslash of `\🌟` as text. The same happens to a multi-character delimiter such as `'~~'`. The writer emits what its reader cannot read back, which `docs/unruled.md` (2026-11-10, `runsToMarkdown`) rules out; either validate delimiters as one UTF-16 unit or match them by code point/string in the reader.
- evidence: read
- severity: low

## fitBoxToText resolves a `{ px }` font size at view scale 1, with no way to pass the scale
- where: packages/text/src/fitBoxToText.ts:26 (fitBoxToText)
- scenario: a text pose with `style.fontSize: { px: 12 }` shown at view scale 4, passed to `fitBoxToText(pose)` → `layoutTextPose(…)` is called with no scale, so the text is laid out at 12 world units instead of 3 and the box comes back four times too tall (and too wide on `axis: 'both'`). Every sibling reader of the same layout (`caretIndexAt`, `textLineBoxes`, `measureTextBounds`, `textToPath`, `bakeTextFit`) takes a `scale` and forwards it to `layoutTextPose`; `FitBoxToTextOptions` has none, so the box it fits disagrees with what the painter draws at any zoom other than 1.
- evidence: read
- severity: low

## Synthetic-bold glyph cache is shared by a wound-positive and an as-authored input, so `textToPath` can get a negatively wound glyph
- where: packages/text/src/syntheticBold.ts:46-56 (emboldenGlyph), 60-71 (emboldenGlyphD); packages/text/src/glyphOutlines.ts:116-124, 163 (emGlyph, glyphOutlineAt)
- scenario: `glyphOutlineAt` hands `emboldenGlyph` the em path from `emGlyph`, reversed to positive winding so glyphs from faces that wind oppositely (TrueType vs CFF) and the decoration rules all add up under `'nonzero'`. `emboldenGlyphD`, which the renderer's outline tier calls (`layout/paintRuns.ts:156`), hands it `pathFromD(d)` as authored. Both land in the same `cache` under the same key `${growth}|${join}|${d}`, and `growRegion`/`mergeRegion` keep each contour's input orientation (`growRegion.ts:50-72`, `mergeRegion.ts:37-41`). So once the canvas has drawn a synthetic-bold glyph from a face whose em-space outlines wind negatively, a later `textToPath` / `textToPathsByPaint` / `textClusters` of the same glyph gets the cached negatively wound outline; under `'nonzero'` an underline or strikethrough rule (wound positive by `ruleContour`) crossing it cancels to winding 0, punching a hole where the rule crosses the stem or descender, and an overlapping positive glyph from another face cancels the same way. Which result you get depends on whether the renderer or `textToPath` asked first. The key should carry the winding (or `emboldenGlyphD` should go through `emGlyph`).
- evidence: read
- severity: medium

## The 2D-canvas markdown path drops a run's `rotate`
- where: packages/text/src/markdownText.ts:144-156 (layoutCanvasRuns), packages/text/src/markdownRenderer.ts:157-197 (createMarkdownRenderer renderer/strokeRenderer)
- scenario: `createMarkdownRenderer(ctx, [{ text: 'abc', rotate: 90 }], 16)` lays out and paints the run upright: `layoutCanvasRuns` never reads `run.rotate` and the painters call `fillText`/`strokeText` with no per-glyph turn. The GL path (`resolveRunsInto` → `PlacedGlyph.rotate`) and `textToPath` (`glyphOutlineAt`) both turn each glyph about its pen. `StyledRun.rotate` documents no tier restriction, and `docs/unruled.md` (line 1595) rules only the canvas path's ignored `fill` and its baseline placement, not this. The same runs therefore draw turned on the canvas tier's GL sibling and upright here.
- evidence: read
- severity: low

## numericWeight reads an empty or blank weight string as 0, not 400
- where: packages/text/src/runs/resolveRuns.ts:148-154 (numericWeight)
- scenario: `numericWeight('')` and `numericWeight(' ')` return 0, because `Number('')` is 0 and finite; the doc promises "anything unparseable as 400". A `TextStyle.fontWeight: ''` (from an imported `font-weight=""`, or a cleared form field) then resolves every run in `resolveRunFace` to weight 0, so `cachedFontVariant` picks the lightest face and `fontString` writes `normal 0 16px …`, which `ctx.font` rejects as invalid, leaving the context's previous font in place on the 2D path. `isBoldWeight('')` happens to answer false either way.
- evidence: read
- severity: low

## textClusters lays a `fit: 'shrink'` node out in a zero-height box, shrinking its clusters to almost nothing
- where: packages/text/src/textClusters.ts:96-100 (clustersOf), with packages/text/src/textToPath.ts:91-101 (outlineLayoutInput)
- scenario: `clustersOf` builds `box = { x: 0, y: 0, width, height: 0 }` and `outlineLayoutInput` copies `data.fit` into the `TextPose` it lays out. For a node with `fit: 'shrink'`, `textPoseLayoutInput` then calls `shrinkScale(runs, opts, width, 0)`: nothing fits a height of 0, so `search` (`layout/textFit.ts:84-108`) returns the smallest scale it tried, about 2^-26. Every cluster comes back with near-zero `advance`, `paths` and `middle`. `text-tools`' `textEffectItems` (`packages/text-tools/src/node/textItems.ts:34`), whose doc promises clusters "sized as the node draws them", passes only `pose.width`, so a shrink-fitted text node set along a path effect lays no visible glyphs, while the node itself draws at the size that fits `pose.height`. `TextClustersOptions` has no `height`, and the cache key (`width`, `scale`) has none either. Either take a `height` and key on it, or drop `fit` when no height is given.
- evidence: read
- severity: medium

## Files read
packages/text/src/bakeTextFit.ts
packages/text/src/fitBoxToText.ts
packages/text/src/glyphOutlines.ts
packages/text/src/glyphTurn.ts
packages/text/src/hitTest.ts
packages/text/src/index.ts
packages/text/src/isTextData.ts
packages/text/src/joiningRuns.ts
packages/text/src/joiningTypes.gen.ts
packages/text/src/markdownRenderer.ts
packages/text/src/markdownText.ts
packages/text/src/measure/graphemes.ts
packages/text/src/measure/lineBoxes.ts
packages/text/src/measure/measureText.ts
packages/text/src/measure/measureTextBounds.ts
packages/text/src/measure/verticalAlign.ts
packages/text/src/pbt.fixture.ts
packages/text/src/pose.ts
packages/text/src/renderLabel.ts
packages/text/src/runs.ts
packages/text/src/runs/codePointCuts.ts
packages/text/src/runs/delimiterRuns.ts
packages/text/src/runs/effectiveRangeStyle.ts
packages/text/src/runs/flagRange.ts
packages/text/src/runs/rangeStyle.ts
packages/text/src/runs/resolveRuns.ts
packages/text/src/runs/smallCaps.ts
packages/text/src/runs/textTransform.ts
packages/text/src/syntheticBold.ts
packages/text/src/syntheticItalic.ts
packages/text/src/test-seams.ts
packages/text/src/textClusters.ts
packages/text/src/textStyle.ts
packages/text/src/textToPath.ts
packages/text/src/visualGraphemes.ts

<!-- done: 7 findings, files read: 35 -->
