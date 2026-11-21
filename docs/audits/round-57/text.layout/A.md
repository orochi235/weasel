<!-- done: 4 findings, files read: 30 -->

I couldn't write `.skulkr/out/findings.md` because permission was denied, so the whole findings document follows.

# Audit round 57: text.layout findings

## Code points handled before the shaped-slot check (space, tab, soft hyphen) throw away their shaped slot, so a mark clustered onto them is never drawn
- where: packages/text/src/layout/layoutEntries.ts:184-196 (measureRuns)
- scenario: a run that gets shaped (a shaper is registered and the face has sfnt bytes) contains a space followed by a combining mark, e.g. `" \u0651"` or `" \u0301"` used to show a mark on its own. The space and the mark form one grapheme, and the shaper returns them as one cluster. So `slotsFor` (shapedRuns.ts:92-97) puts the whole cluster, space glyph and mark glyph, on the space's slot, and gives the mark's slot `COVERED` (no glyphs, advance 0). `measureRuns` tests `cp === 9 || cp === 32` (and `SOFT_HYPHEN`) before `slot !== undefined`. The space therefore goes down the `whiteSpace` path and drops the cluster, and the mark then takes `COVERED` and draws nothing. The mark disappears when it should draw. The same ordering also loses the share of a cluster's advance that `slotsFor` gave to a grapheme opening at a soft hyphen or space inside a multi-grapheme cluster: the line measures short by that share.
- evidence: read
- severity: low

## A throw inside `layoutRuns` on a structural-list eviction leaves a listed entry pointing at recycled columns
- where: packages/text/src/layout/layoutCache.ts:261-265 (structuralLayout)
- scenario: the structural list is full (64 entries). `unlist(structural[oldest])` runs before `layoutRuns`, and it can `release` that entry's layout, sending its columns and its `laid` object back to the pool. If `layoutRuns` then throws (a consumer `bidi`/`shaper` engine throws, or opentype.js throws while parsing a corrupt glyph or kerning table), `structural[oldest]` keeps its old `hash`, `runs` and `laid`. The next lookup whose runs equal that entry's content returns `s.laid`. Its columns sit in `spare` or have been taken by another layout through `LayoutColumns.take`, and `cols.laid` is the same object. So the text displays another text's lines, or empty columns. The eviction should only commit after `layoutRuns` succeeds, or the entry should be made unmatchable (`hash = -1`, `laid = NO_LAYOUT`) the way `evictRunsForRefill` does it.
- evidence: read
- severity: low

## A throw mid-painting leaves the group slots filled, and the next painting returns the previous one's groups, including one whose quadData is the shared scratch
- where: packages/text/src/layout/paintGroups.ts:126-142 (slots/last, takeGroups); packages/text/src/layout/paintRuns.ts:246-310 (paintRunsInto)
- scenario: `groupFor` pushes into module-level `slots` and sets `last`. Only `takeGroups`, at the very end of `paintRunsInto`, empties them. There is no `try`/`finally`, unlike `wrapSpans` with its `breakScratchTaken`. If anything in the glyph loop throws (`glyphOutline` parsing a malformed glyph, `emboldenGlyphD`, `requestShaped`, `paintKey` on a bad paint), the next `paintRunsInto` call finds stale groups. Through the `last` fast path it can add glyphs to them, and `takeGroups` puts them in its output, so a text draws another text's glyphs. The first group of the failed painting still has `quadData === scratch` (the shared buffer). Once that painting is recycled, `recyclePaintings` calls `giveDoubles(scratch)`, so the pool later hands the live scratch array to a layout or painting while `paintRuns` keeps writing into it.
- evidence: read
- severity: low

## `outlineMinSize: NaN` lands in the same paint-cache bucket as a threshold no run reaches, but paints every glyph as an outline
- where: packages/text/src/layout/paintCache.ts:103-114 (outlineBucket) vs packages/text/src/layout/paintRuns.ts:146 (glyphOutlineD)
- scenario: `outlineBucket` counts a size as reaching the threshold only when `size >= min`, so `NaN` gives bucket 0. `glyphOutlineD` gates with `run.fontSize < minSize`, which is false for `NaN`, so every glyph is drawn as an outline. A runs array painted at `outlineMinSize = Infinity` (or any value above every run size; bucket 0, no outlines) and then asked at `NaN` gets the cached no-outline painting from `mineHere && own.bucket === bucket`. The reverse also happens: a `NaN` painting full of outlines is reused for a large threshold. The two comparisons answer one decision two ways, and they should agree on how `NaN` is treated. A threshold computed as `screenMin / scale` with a degenerate scale produces `NaN`.
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

<!-- done: 4 findings, files read: 30 -->