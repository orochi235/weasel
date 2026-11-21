I couldn't write `.skulkr/out/findings.md` because permission was denied, so the whole document is below.

# Audit round 58 — text.layout

## The pooled `Line` objects keep the previous layout's entries, defeating `POOL_MAX`'s bound
- where: packages/text/src/layout/layoutLines.ts:94 (pushSpan), :148/:171 (breakLines); packages/text/src/layout/layoutEntries.ts:252 (POOL_MAX)
- scenario: `measureRuns` keeps at most `POOL_MAX` (4096) entries so that "one long text does not hold its entries for good". But `breakLines` copies every entry of a line into `line.entries` of a `Line` from `linePool`, which keeps up to 64 `Line` objects for the life of the module. `pushSpan` resets a reused line's numbers and leaves `entries` alone, and `entries` is only truncated when that slot is reused by a later layout. Lay out a 64-line, 50 000-code-point text once, then only one-line labels: lines 1–63 keep about 49 000 `Entry` objects alive indefinitely. About 46 000 of them are fresh objects past `POOL_MAX`, plus any tab copies (`whiteSpace` returns `{ ...e }`) and bidi-mirrored copies (`mirrorEntries`). Each one holds its `resolved`, `metrics`, `font` atlas, `glyph` and its `shaped` cluster, including that cluster's path-data string `d`. The fix is to truncate `entries` on every pooled line past `brokenCount` (or when the line is handed out), so a line holds nothing once the layout it served has finished.
- evidence: read
- severity: low

## Positions the bidi engine removed (X9) get level 0, not the level of the character they are placed beside
- where: packages/text/src/layout/bidiLines.ts:172-187 (reorderedLine)
- scenario: `@weasel-js/bidi`'s `reorder` reports `-1` for a removed position (packages/bidi/src/reorder.ts:23,55), and `reorderedLine` turns any negative level into 0. Then `restoreRemoved` places that position beside the character it follows, on that character's reading side, so its visual slot treats it as part of that run while its `LaidOutCell.level` says left to right. Some concrete cases in a right-to-left paragraph:
  - a soft hyphen the wrap ended a line at, which `hyphenate` turns into a drawn U+2010 hyphen;
  - a ZWJ or ZWNJ inside an Arabic word;
  - an RLM or LRM.
  Each gets `level: 0` and sits among level-1 cells. A consumer that reads `cell.level` to pick caret affinity, or to group cells into directional runs (as the field's doc invites), sees a false LTR run in the middle of RTL text. The level should be the one of the kept position it was restored beside (UAX #9 §5.2, "Retaining BNs and Explicit Formatting Characters": the preceding character's level), which `restoreRemoved` already knows.
- evidence: read
- severity: low

## `JOINED_ENDS` grows to the longest text ever measured and never shrinks, unlike every sibling scratch, which caps at 2^16
- where: packages/text/src/layout/layoutEntries.ts:217-239 (clusterEndsAcross)
- scenario: The same problem is answered two ways. `lineBreaks.ts` (`SCRATCH_MAX`) and `wrapLines.ts` (`BREAK_SCRATCH_MAX`) both build their own array past 1 << 16 code points "rather than growing the shared ones for good". `JOINED_ENDS` is regrown to `joined.length + 1` with no limit and kept in the module. Measure one multi-run text whose run boundaries fall inside a cluster (`spans` true: for example, any run that opens with a code point at or above U+0300, like a CJK or Arabic run after another run) with 5 000 000 UTF-16 units, and 5 MB stays pinned for the process's life. The fix is to apply the same `> 1 << 16` builds-its-own rule here.
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