## LB20a does not hold a word-initial hyphen before a Hebrew letter
- where: packages/text/src/layout/lineBreak/lineBreaks.ts:186 (decide)
- scenario: UAX #14 (Unicode 15.1+/16.0, the table's version) LB20a is `( sot | BK | CR | LF | NL | SP | ZW | CB | GL ) ( HY | ‐ ) × ( AL | HL )`. The code tests only `B === AL`, so for `"-שלום"` at the start of a text, or after a space, the pair HY HL falls through: LB21 does not apply (B is HL, not BA/HY/NS), LB21a needs an HL before the hyphen, and LB28 needs A alpha. The result is BREAK_ALLOWED at position 1, so the wrap can leave the hyphen alone on one line. It should be NO_BREAK.
- evidence: read
- severity: low
- fix: packages/text/src/layout/lineBreak/lineBreaks.ts
- size: line
- cause: rule transcribed as `× AL` instead of `× (AL | HL)`
- confidence: likely

## `breakLines`' prefix-sum scratch grows to the longest text ever laid out and never shrinks
- where: packages/text/src/layout/layoutLines.ts:93 (sum), 142 (breakLines)
- scenario: lay out one 1,000,000-code-point text once. `sum = doubles(entries.length + 1)` makes a module-level array of 1M doubles (8 MB), and it stays for the life of the process. Every other piece of per-call scratch in this area has a cap: `SCRATCH_MAX` in lineBreaks and paintRuns, `BREAK_SCRATCH_MAX` in wrapLines, `JOINED_ENDS_MAX` and `POOL_MAX` in layoutEntries, `LINE_POOL_MAX`. Past a cap, a call should build its own array, the way those do.
- evidence: read
- severity: low
- fix: packages/text/src/layout/layoutLines.ts
- size: line
- cause: unbounded module scratch
- confidence: sure

## Recycled `LayoutColumns` in the spare pool keep every line box of the layout they held
- where: packages/text/src/layout/layoutColumns.ts:93 (LayoutColumns.recycle)
- scenario: `recycle()` gives back `num` and `ref` but leaves `boxes` (one `LineBox` per line) and `laid` as they are, then pushes the columns onto `spare`, which holds up to 1024. A 50,000-line text whose layout is released (for example by `evictRuns`, or by textFit's `boundsAt`) leaves 50,000 LineBox objects reachable from the spare pool. They stay until the next `take()` happens to pop those exact columns and `layoutRuns` sets `lines.length` back down. The pool caps how many columns it holds, but not how much any one of them holds.
- evidence: read
- severity: low
- fix: packages/text/src/layout/layoutColumns.ts
- size: line
- cause: spare pool bounded by count, not size
- confidence: sure

## The array pool never evicts, so sizes nobody asks for again fill it and block it for good
- where: packages/text/src/layout/arrayPool.ts:48 (give)
- scenario: `give` turns an array away once `held + n > ARRAY_POOL_LIMIT`, and nothing ever drops a held array except a `take` of that exact length. Suppose a readout's text passes through many lengths, or a few large paragraphs are released. The pool fills with lengths that never recur, and from then on every `giveDoubles` and `giveRefs` is refused. Per-frame layouts go back to allocating, which is the thing the pool exists to prevent. Empty buckets also stay in the `Map` for every length ever pooled.
- evidence: read
- severity: low
- fix: packages/text/src/layout/arrayPool.ts
- size: function
- cause: no eviction policy on a full pool
- confidence: likely

## The RTL-without-engine warning misses N'Ko, Samaritan and Mandaic
- where: packages/text/src/layout/bidiRegistry.ts:68 (RTL_BLOCKS)
- scenario: the ranges `[0x0600, 0x07bf]` and `[0x0860, 0x08ff]` leave out U+07C0–U+085F: N'Ko (07C0–07FF), Samaritan (0800–083F) and Mandaic (0840–085F), all Bidi_Class R. N'Ko text laid out with no engine registered draws reversed and never warns.
- evidence: read
- severity: low
- fix: packages/text/src/layout/bidiRegistry.ts
- size: line
- cause: block table gap
- confidence: sure

## The shaping-without-engine warning misses Mandaic
- where: packages/text/src/layout/shaperRegistry.ts:83 (SHAPED_BLOCKS)
- scenario: Mandaic (U+0840–U+085F) is a joining script, but `[0x0600, 0x07ff]` and `[0x0860, 0x08ff]` skip it. Mandaic text laid out with no shaper is drawn unjoined, and the warning does not fire.
- evidence: read
- severity: low
- fix: packages/text/src/layout/shaperRegistry.ts
- size: line
- cause: block table gap
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

<!-- done: 6 findings, files read: 31 -->
