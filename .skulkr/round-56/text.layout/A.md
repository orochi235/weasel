I couldn't write `.skulkr/out/findings.md` because permission to write there was denied, so the whole findings document is below.

# Audit round 56: text.layout, blind reviewer

## Shrink-to-fit scales a run's sizes but not its stroke width, so fitted stroked text gets heavier the more it shrinks
- where: packages/text/src/layout/textFit.ts:56 (scaledRun), also :71 (scaleStyle)
- scenario: a text pose with `fit: 'shrink'` and a stroke 2 world units wide, on 100-unit text that has to shrink to scale 0.1. `scaledRun` scales `fontSize`, `letterSpacing`, `baselineShift`, `sizeMap` and `strutSize`, but copies `stroke` unchanged. `scaleStyle` does the same with `style.stroke`. The renderer strokes an outline glyph at `width / glyph.scale` ems (`packages/renderer/src/glyphOutlineMesh.ts:71`). So the 10-unit text gets a stroke of 0.2 em instead of 0.02 em: ten times as heavy relative to the glyph, and small fitted text clogs. A stroke dash grows the same way (`scaledDash(stroke, 1 / glyph.scale)`). The module's own doc says "Every size and spacing a run carries scales with it", and a numeric `stroke.width` and its dash array are such sizes. A `{ px }` width is measured on screen, so leaving it alone is right.
- evidence: read
- severity: medium

## `JOINED_ENDS` grows to the longest text ever measured and never shrinks
- where: packages/text/src/layout/layoutEntries.ts:234 (clusterEndsAcross)
- scenario: one layout of a 5,000,000-unit text split into several runs, where a run boundary sits next to a unit at or above U+0300 (any boundary next to CJK, emoji or accented text takes this path). The module-level `JOINED_ENDS` is reallocated to at least `joined.length + 1` bytes and kept for the life of the process, so 5 MB stays allocated after that text is gone. The other shared scratch arrays on this path are capped for exactly this reason: `breakScratch` (`wrapLines.ts:71`, `BREAK_SCRATCH_MAX`, "rather than growing the shared ones for good") and the line-break columns (`lineBreaks.ts:54`, `SCRATCH_MAX`). Past a similar cap, the call should build a buffer of its own.
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

<!-- done: 2 findings, files read: 30 -->