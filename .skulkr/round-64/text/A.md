## transformRunTexts goes quadratic in paragraph length whenever a contextual case mapping changes length
- where: packages/text/src/runs/textTransform.ts:118-131 (piecesOf, fallback branch)
- scenario: a paragraph under `textTransform: 'lowercase'` with `lang: 'tr'` (or `'az'`) holding one `İ` anywhere, or under `'uppercase'` with `lang: 'el'` holding one decomposed accent (`ά`), so the whole-string mapping is a different length from the per-code-point sum. `piecesOf` then calls `map(full.slice(0, prefix))` once per code point, re-mapping the whole prefix each time: O(n²) in the paragraph. `resolveRunsInto` calls this on every `textPoseLayoutInput`, before the layout cache is consulted, so every hit test, line-box query, fit and paint of a 20k-character NFD Greek paragraph does about 2·10⁸ character mappings. That takes seconds per call, where it should be linear like the equal-length branch. The fallback only has to find where the lengths diverge, and could map around those points instead of re-mapping every prefix.
- evidence: read
- severity: medium

## joiningRuns reads the Cf code points that ArabicShaping.txt lists as U (non-joining) as transparent, so it joins letters across them
- where: packages/text/src/joiningRuns.ts:6,20 (joiningTypeOf), with packages/text/scripts/gen-joining-types.mjs (KEPT drops explicit `U` rows)
- scenario: the generator keeps only D/R/L/C rows, and any code point not in the table falls back to `T` if it is Mn/Me/Cf. ArabicShaping.txt explicitly lists several Cf characters as `U`: U+0600–0605 (Arabic number signs, which Prepend onto the next grapheme), U+06DD, U+0890–0891, U+08E2, U+110BD and U+110CD. The grapheme `؀١` (U+0600 + digit) therefore reads as `T`. In `joiningRuns(['ب', '؀١', 'ب'])`, `joined(0)` is true because `types[1] === 'T'`, and `joined(1)` skips the "transparent" sign so the two behs look joined. The result is one run `ب؀١ب` where it should be three: `ب`, `؀١`, `ب`. The `T` fallback should apply only to code points the file does not list at all; listed `U` rows need to be carried as an exclusion.
- evidence: read
- severity: low

## layoutCanvasRuns synthesizes small caps for a face with its own smcp glyphs, unlike resolveRuns
- where: packages/text/src/markdownText.ts:106-116 (segmentsOf), vs packages/text/src/runs/resolveRuns.ts:232-242 and packages/text/src/runs/smallCaps.ts:42-47
- scenario: a run with `fontVariantCaps: 'small-caps'` in a family whose registered shaper reports `smcp`. On the GL tier, `resolveRuns` asks `hasOwnSmallCaps` and draws the face's real small capitals at full size through the `smcp` feature. The 2D painter (`createMarkdownRenderer` → `layoutCanvasRuns`) never asks, so it always uppercases the text and draws it at `smallCapsScale(face)`. The same run gets different glyphs and widths on the two tiers. `hasOwnSmallCaps`'s own doc says every reader of small caps asks it so that the tiers set the same capitals.
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

<!-- done: 3 findings, files read: 35 -->
