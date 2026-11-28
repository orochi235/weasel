## evictRunsForRefill blanks only the last structural entry a runs array filled; others keep comparing against the refilled array
- where: packages/text/src/layout/layoutCache.ts:270 (evictRunsForRefill), packages/text/src/layout/layoutCache.ts:237 (structuralLayout, `entry.listed = filled`)
- scenario: one runs array R is laid out under two option sets (say two `alignWidth`s). Each miss fills a structural entry (S1, then S2), and `entry.listed` is overwritten to S2. `evictRunsForRefill(R)` blanks S2 only, so S1 still holds `runs: R` with R's old hash. The caller then refills R in place with a change `runsHash` does not see: toggling small caps changes only `sizeMap`, and swapping `fontFeatures` for a list of the same length changes only their contents. `cachedLayoutRuns(R, opts1)` misses the emptied variants. In the structural list S1's hash still equals the new hash, `matches` passes, and `sameRuns(S1.runs, R)` compares R with itself and returns true, so the layout of R's old content is returned. Expected: a fresh layout. Even when the hash does change, S1 keeps its layout `listed` and R pinned until the LRU evicts it.
- evidence: read
- severity: medium
- fix: packages/text/src/layout/layoutCache.ts, packages/text/src/layout/runsEntries.ts
- size: function
- cause: one `listed` slot per runs entry, though several structural entries can hold the same runs
- confidence: likely

## `breakLines`' prefix-sum scratch grows to the longest text ever laid out and never shrinks
- where: packages/text/src/layout/layoutLines.ts:139 (breakLines, `sum = doubles(entries.length + 1)`)
- scenario: one layout of a 1,000,000-code-point paste grows the module-level `sum` to 1M doubles (about 8 MB), and it stays held for the rest of the process. The other per-call scratches here each stop growing at a cap and build their own array past it: `lineBreaks` `SCRATCH_MAX`, `wrapLines` `BREAK_SCRATCH_MAX`, `layoutEntries` `JOINED_ENDS_MAX` and `paintRuns` `SCRATCH_MAX`, each 1<<14 to 1<<16. `sum` has no such cap.
- evidence: read
- severity: low
- size: line
- cause: shared scratch with no size cap
- confidence: sure

## `registerTallFont` leaves `global.fetch` stubbed when the registration throws
- where: packages/text/src/layout/testing/fontFixtures.ts:39 (registerTallFont)
- scenario: if `registerFont('tall', …)` rejects (for example, the font was already registered under a conflicting entry, or the prior stub rejects the png URL), the line `global.fetch = prior` never runs. Every later test in that worker then fetches through the tall-font wrapper rather than the stub it installed. The restore should sit in a `finally`.
- evidence: read
- severity: low
- size: line
- cause: restore not in finally
- confidence: sure

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
