The findings file was written once at the start; after that the harness refused further writes to it. So the file on disk holds only a draft of the first two findings and no read list. The full document is below.

# Audit round 58 — area `text.layout`

Note: the brief names frozen commit b400d7039e…, which this checkout does not contain (`git cat-file` reports a bad object). The tree read is HEAD a22801b42b. `git status` shows no changes under `packages/text/src/layout`.

## Shrink-to-fit scales every run size but not its stroke width, so a shrunk outlined text keeps its full-size outline
- where: packages/text/src/layout/textFit.ts:56 (scaledRun), used by packages/text/src/layout/textPoseLayout.ts:60 (textPoseLayoutInput)
- scenario: take a text pose with `fit: 'shrink'`, fontSize 100 and `stroke: { width: 4, paint }`, in a box that forces k = 0.25. The stroke width is in world units, per `TextPaint.stroke` in textStyle.ts.
  - `scaledRun` scales `fontSize`, `letterSpacing`, `baselineShift`, `sizeMap` and `strutSize`, but copies `stroke` unchanged.
  - `scaleStyle` also copies `style.stroke` unchanged, and nothing else in the repo applies `fitScale` to a stroke.
  - Result: the 25-unit glyphs get a 4-unit outline, four times as heavy relative to the glyph as the same text unfitted. A dashed stroke keeps its full-size dash.
  - The module doc says "every size and spacing a run carries scales with it".
  - Expected: a world-unit stroke width and dash are scaled by k; a `{ px }` width is left alone.
- evidence: read
- severity: medium

## A covered code point in a right-to-left shaped cluster reads as left-to-right, so a mirrorable one is drawn a second time
- where: packages/text/src/layout/shapedRuns.ts:28 (NOTHING_DRAWN), packages/text/src/layout/layoutEntries.ts:366 (mirrorEntries)
- scenario: a code point drawn by another code point's cluster (a `COVERED` slot, or a grapheme opener inside a ligature) holds `NOTHING_DRAWN`, whose `rtl` is always `false`.
  - In a right-to-left run every such slot resolves to an odd level, so `mirrorEntries` sees `entry.shaped.rtl (false) !== odd (true)`.
  - If that code point is mirrorable, `unshaped` gives the slot its own glyph, which is then mirrored. An example is a bracket inside a cluster the shaper merged, such as a bracket ligature or a contextual-substitution merge.
  - The cluster's opener already draws that bracket in its `d`, so the bracket is painted twice.
  - Expected: a covered slot carries its cluster's direction, or the disagreement test skips it, so it keeps drawing nothing.
- evidence: read
- severity: low

## A code point the bidi engine removed reports level 0 inside a right-to-left line, so the hyphen a wrapped RTL line draws hit-tests the wrong way
- where: packages/text/src/layout/bidiLines.ts:173 (reorderedLine)
- scenario: `@weasel-js/bidi`'s `reorder` returns `-1` for every position X9 removed (`packages/bidi/src/reorder.ts:23`). `reorderedLine` turns any level that is not `>= 0` into 0.
  - A soft hyphen is class BN, so the engine removes it.
  - When an Arabic or Hebrew paragraph wraps at a soft hyphen, `breakLines` turns it into a visible hyphen with real advance, and `restoreRemoved` correctly places it at the line's left end. Its cell's `level`, however, is 0.
  - `caretIndexAt` (`packages/text/src/hitTest.ts:102`) reads `level % 2`. A click on the hyphen's left half returns `srcIndex` and its right half returns `srcEnd`, the reverse of every other cell on that line.
  - A click left of the line lands before the soft hyphen instead of at the line's logical end.
  - Other removed controls inside RTL text (ZWNJ, LRM/RLM) also get level 0.
  - Expected: a removed position takes the level of the character `restoreRemoved` anchors it to, or the paragraph level when it opens the line.
- evidence: read
- severity: low

## Files read
packages/text/src/layout/arrayPool.ts
packages/text/src/layout/bidiLines.ts
packages/text/src/layout/bidiRegistry.ts
packages/text/src/layout/bidiSeam.ts
packages/text/src/layout/decorationMetrics.ts
packages/text/src/layout/engineGeneration.ts
packages/text/src/layout/engineSlot.ts
packages/text/src/layout/glyphQuads.ts
packages/text/src/layout/layoutCache.ts
packages/text/src/layout/layoutColumns.ts
packages/text/src/layout/layoutEntries.ts
packages/text/src/layout/layoutLines.ts
packages/text/src/layout/layoutOpts.ts
packages/text/src/layout/layoutRuns.ts
packages/text/src/layout/lineBreak/lineBreakTable.ts
packages/text/src/layout/lineBreak/lineBreaks.ts
packages/text/src/layout/lineBreak/wrapLines.ts
packages/text/src/layout/paintCache.ts
packages/text/src/layout/paintGroups.ts
packages/text/src/layout/paintRuns.ts
packages/text/src/layout/runsEntries.ts
packages/text/src/layout/runsKey.ts
packages/text/src/layout/shapedRuns.ts
packages/text/src/layout/shaperRegistry.ts
packages/text/src/layout/shaperSeam.ts
packages/text/src/layout/tabStops.ts
packages/text/src/layout/testing/fontFixtures.ts
packages/text/src/layout/testing/layoutAndPaint.ts
packages/text/src/layout/textFit.ts
packages/text/src/layout/textPoseLayout.ts

<!-- done: 3 findings, files read: 30 -->