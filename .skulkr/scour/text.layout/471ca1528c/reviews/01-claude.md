# Findings: text.layout

## Line-breaking and measuring scratch grows to the longest text ever laid out and keeps its entries alive
- where: packages/text/src/layout/layoutLines.ts:83 (module `sum`, `tabs`, `broken`), packages/text/src/layout/layoutRuns.ts:200 (`ENTRIES`, `CPS`)
- scenario: one layout of a 1,000,000-code-point text (a pasted document, a log viewer) grows `sum` to 1M doubles (8 MB) through `doubles(entries.length + 1)`. Nothing ever shrinks it. `ENTRIES` keeps a reference to every `Entry` of that layout until the next layout runs. That includes the entries past `POOL_MAX` and every tab copy, along with their `ResolveResult`, metrics and atlas refs. `CPS` keeps 1M numbers, and the `broken` lines in use keep their `entries` arrays. The scratch everywhere else in this area stops at 1 << 16 and builds a call's own past that: `lineBreaks` `SCRATCH_MAX`, `wrapLines` `BREAK_SCRATCH_MAX`, `layoutEntries` `JOINED_ENDS_MAX`, `paintRuns` `SCRATCH_MAX`, `arrayPool` `TEMPLATE_LIMIT`. Expected: these follow the same rule, or are cut back after a call that overran it.
- evidence: read
- severity: low
- fix: packages/text/src/layout/layoutLines.ts, packages/text/src/layout/layoutRuns.ts
- size: function
- cause: unbounded module scratch
- confidence: sure

## A blank line in a right-to-left paragraph aligns as left-to-right under `direction: 'auto'`
- where: packages/text/src/layout/layoutRuns.ts:244 (layoutRuns, `reads`)
- scenario: take `"שלום\n\nעולם"` with `align: 'start'` (or `'end'`), `direction: 'auto'` and a bidi engine. The empty middle line gets `reads = directionOfLevel(0)`, which is `'ltr'`, because `line.entries.length === 0`. `alignOffset` then sets its zero-width box (`x0 === x1`, the line's only caret stop) at the left edge, while both neighboring lines sit at the right edge. The caret on the empty line jumps to the opposite side of the box. Expected: an empty line takes the direction of the text around it (the previous paragraph's, or the first resolved one) rather than defaulting to LTR.
- evidence: read
- severity: low
- size: line
- cause: blank line has no paragraph, defaults to level 0
- confidence: likely

## Justify widens only U+0020, so gaps of no-break space stay narrow
- where: packages/text/src/layout/layoutLines.ts:228 (wordGaps)
- scenario: under `align: 'justify'`, a wrapped line `"10 km and more"` widens only its U+0020 gaps; the U+00A0 between `10` and `km` keeps its natural width. CSS Text counts U+00A0 (and U+3000, U+1361, etc.) as word-separator characters that justification expands. Expected: every word separator gets an equal share of the slack.
- evidence: read
- severity: low
- size: line
- cause: word separator tested as cp === 32 only
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

<!-- done: 3 findings, files read: 31 -->
