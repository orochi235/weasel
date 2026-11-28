## `evictRuns` leaves the entry's painting keyed on the runs it drops, so its key can be built later from a refilled array
- where: packages/text/src/layout/layoutCache.ts:221 (evictRuns)
- scenario: Runs array A is painted on layout L. That painting `p` has `key === null` and `p.runs === A`, and sits in L's paintings list. L stays alive because another runs array W owns it through a structural hit. The caller calls `evictRuns(A)`, whose doc says passing A again "is only a cache miss", then rewrites A in place with new paints and lays it out again. Later W misses its own painting (the glyph generation moved, or the outline bucket changed) and searches L's list. `keyOf(p)` now builds the key from A's *new* paints. If those equal W's paints, W is handed `p`, whose groups and decorations carry A's *old* fills. `evictRunsForRefill` avoids this by calling `settlePainting(p, runs)`; `evictRuns` does not.
- evidence: read
- severity: low
- fix: packages/text/src/layout/layoutCache.ts
- size: line
- cause: the lazy painting key is not settled on evict
- confidence: likely

## Recycled layout columns keep their line boxes' built `cells`/`glyphs` views, pinning per-code-point objects in the spare pool
- where: packages/text/src/layout/layoutColumns.ts:97 (LayoutColumns.recycle)
- scenario: A `'read'` caller (caret hit-testing, picking) reads `line.cells` or `line.glyphs` on a layout. `LineBox`'s lazy getters then replace themselves with arrays holding one object per code point, and each `PlacedGlyph` references its `ResolveResult`, metrics, atlas and glyph record. When the layout is recycled, `recycle()` hands back `num`/`ref` but keeps `boxes`, so those view arrays live on in `spare` (up to 1024 columns) until a later layout happens to `refill` that same box index. A long paragraph read once can keep thousands of objects and font references alive indefinitely. That defeats the pool's stated bound ("a paragraph handed back cannot pin memory").
- evidence: read
- severity: low
- fix: packages/text/src/layout/layoutColumns.ts
- size: function
- cause: recycle does not reset the boxes' views
- confidence: likely

## The array pool never deletes an emptied bucket, so its map grows with every distinct length ever handed back
- where: packages/text/src/layout/arrayPool.ts:39 (take / give)
- scenario: Text whose length varies (readouts, typed input, many different labels) gives back column and quad arrays of many distinct lengths (`size*13`, `size*5`, `count*11`). `take` drains a bucket to `n === 0` but leaves the `Map` entry, and its `items` array keeps its peak length. Element count is capped by `ARRAY_POOL_LIMIT`, but the number of buckets and the size of their slot arrays are not. A long session accumulates an entry for every length seen.
- evidence: read
- severity: low
- fix: packages/text/src/layout/arrayPool.ts
- size: line
- cause: the cache has no bound on its keys
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
