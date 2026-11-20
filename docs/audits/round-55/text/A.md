<!-- done: 6 findings, files read: 35 -->

The findings file write was declined, so here is the whole document, as the brief allows.

# Audit round 55 — area `text` (blind reviewer)

## textClusters lays a `fit: 'shrink'` node out in a zero-height box, so text on a path shrinks to almost nothing
- where: packages/text/src/textClusters.ts:98 (clustersOf)
- scenario: `clustersOf` builds `box = { x: 0, y: 0, width, height: 0 }` and passes it to `outlineLayoutInput`, which forwards `data.fit` into `textPoseLayoutInput`. `textEffectItems` (text-tools) hands over the node's own data. With `fit: 'shrink'`, `shrinkScale` searches a box 0 tall:
  - The search's starting guess is `min(width/w, 0/h) = 0`.
  - `lo` stays 0, so the loop's stop test `hi - lo > TOLERANCE·hi` is always true.
  - All 24 halvings run and it returns `hi = 2^-24`.

  The result: every glyph of a fitted node laid along a path comes out about 6e-8 of its size, invisible. It should lay out at the size the node draws at (fit resolved against the node's real box), or with `fit` ignored.
- evidence: read (textFit.ts `search`; text-tools/src/node/textItems.ts:34 passes `data` and only `width`)
- severity: medium

## The synthetic-bold cache uses one key for winding-normalized and raw outlines, so textToPath's bold glyphs wind according to draw history
- where: packages/text/src/syntheticBold.ts:44 (emboldenGlyph), :67 (emboldenGlyphD); packages/text/src/glyphOutlines.ts:163 (glyphOutlineAt)
- scenario: Two callers feed the same `cache`:
  - `glyphOutlineAt` passes `emGlyph(d)`, which is reversed to positive winding when `pathSignedArea < 0`.
  - The renderer's outline tier calls `emboldenGlyphD(d)`, which passes the raw `pathFromD(d)`.

  Both store under `${growth}|${join}|${d}`, and `growRegion`/`mergeRegion` keep the input's orientation. Take a face whose outlines come out negatively wound (the TrueType/CFF case `emGlyph` exists for). Once the renderer has drawn one of its glyphs faked bold, `textToPath`/`textClusters` get the cached negatively wound geometry. Every non-bold glyph and every decoration rule is positive. Under `'nonzero'`, an underline crossing that glyph's descender, or two glyphs kerned into each other, cancel to a hole. Before the renderer has drawn the glyph, the same call returns positive geometry. The two inputs should be keyed apart, or winding normalized before growing on both paths.
- evidence: read (geom growRegion.ts:50 `sigma = closedSignedArea(path) < 0 ? -1 : 1`; mergeRegion.ts:49 `fillLeft`)
- severity: medium

## With a bidi engine, visualGraphemes keeps LRM/RLM/ALM and isolate-control graphemes that its doc and its no-engine path drop
- where: packages/text/src/visualGraphemes.ts:31-40
- scenario: The doc says "Graphemes holding only bidi controls drop out". The no-engine path filters them with `BIDI_CONTROLS`, which covers U+061C, U+200E/F, U+202A–E and U+2066–9. The engine path relies on `reorder` omitting them. `@weasel-js/bidi` omits only what X9 removes: LRE/RLE/LRO/RLO/PDF and BN. LRM, RLM and ALM are strong characters, and LRI/RLI/FSI/PDI are kept by design (bidi explicit.ts:7-9). Each of these is its own grapheme (GCB=Control), so for example `['a', '\u200f', 'b']` returns `['a', '\u200f', 'b']` with the engine and `['a', 'b']` without it. The caller then draws a control as a glyph slot (tofu or an empty advance). The test only covers RLE/PDF.
- evidence: read
- severity: low

## patchRangeStyle keeps the range's value for a key armed `undefined`, while text-dom's armedOver takes it off: one decision, two answers
- where: packages/text/src/runs/rangeStyle.ts:193-198 (patchRangeStyle)
- scenario: `docs/unruled.md` (2026-11-10) rules that `pendingStyle` may hold a key as `undefined` to take it off, and that the typed character lands "as a write of the same patch would". `applyStyleToRange`/`patchRun` deletes the key. `patchRangeStyle` is exported and documented as "keyed as a write of `patch` would leave the runs — for showing styling armed for the next keystroke". Yet it filters out `undefined` values, so `patchRangeStyle({ fontSize: 12 }, { fontSize: undefined })` reports `fontSize: 12` (its test asserts this) while the typed character inherits the node's size. text-dom no longer uses it and wrote `armedOver` (text-dom/src/armedStyle.ts:45), which deletes the key. The public helper still gives the old answer and contradicts its own first sentence.
- evidence: read
- severity: low

## layoutCanvasRuns does not rejoin a surrogate pair split across runs, which the GL path does
- where: packages/text/src/markdownText.ts:96-117 (segmentsOf), :237 (codePointsOf)
- scenario: `codePointCuts.ts` states that "layout joins a pair that authored runs split anyway", and `resolveRunsInto` calls `rejoinSplitPairs`. The canvas path never does. Take runs `[{ text: '\ud83d', bold: true }, { text: '\ude00' }]`, as an offset-based range write can produce. `transformRunTexts`/`codePointsOf` iterate each run alone, so two lone surrogates become separate code points and pieces. `measure` and `fillText` then measure and draw two replacement glyphs where the GL tier draws one 😀, and the two tiers' widths and line breaks disagree.
- evidence: read
- severity: low

## TextOutlineSource documents an absent `fill` as default black, but it resolves to no fill
- where: packages/text/src/textToPath.ts:39 (TextOutlineSource.fill)
- scenario: The doc reads "`null` is no fill, absent the default black". `outlineLayoutInput` → `textPoseLayoutInput` → `resolveTextStyle(style, { fill: undefined })` → `resolveFill(undefined)` returns `null`. `DEFAULT_TEXT_STYLE.fill` is `null`, and `DEFAULT_TEXT_FILL`'s doc says a node read with no fill paints no glyphs. So `textToPathsByPaint({ text: 'a' }, …)` returns `fill: null`, and a caller that leaves `fill` out expecting black, as this doc tells it to, exports unfilled outlines.
- evidence: read
- severity: low

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

<!-- done: 6 findings, files read: 35 -->