# Findings: text.layout

## An empty line inside a right-to-left paragraph aligns as left-to-right
- where: packages/text/src/layout/layoutRuns.ts:263 (layoutRuns)
- scenario: `direction: 'auto'`, a bidi engine registered, `align: 'start'`, text `"שלום  עולם"` (or VT / FF in place of U+2028). U+2028, VT and FF are hard line breaks (`isHardLineBreak`) but not paragraph separators (`isParagraphSeparator`), so all three lines belong to one RTL paragraph, and `paragraphs.baseLevel(line.start)` would answer 1 for the empty middle line, whose `line.start` is the index of the second U+2028 inside that paragraph. The guard `line.entries.length > 0 ? … : 0` forces level 0 for every empty line, so `reads` is `'ltr'`, `start` resolves to `left`, and the empty line's box (and the caret placed on it) sits at x = 0 while the lines around it are right-aligned at `alignWidth`. It should sit at the right edge, as the paragraph does. The guard is only needed for an empty line made by a paragraph separator, and `baseLevel` already answers 0 there because `holding` finds no paragraph.
- evidence: read
- severity: low
- fix: packages/text/src/layout/layoutRuns.ts
- size: line
- cause: empty-line guard overrides a correct baseLevel
- confidence: likely

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
packages/text/src/layout/mirrorEntries.ts
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

<!-- done: 1 findings, files read: 31 -->
