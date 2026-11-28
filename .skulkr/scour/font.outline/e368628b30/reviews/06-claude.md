## GPOS ScriptList records sharing one Script table multiply the LangSys walk past the work budget
- where: packages/font/src/outline/gposKerning.ts:128 (lookupIndexSets)
- scenario: a GPOS whose ScriptList has 65535 records all pointing at one Script table with 65535 LangSys records (~790 KB). `langSysesOf` memoizes the Script, so `spend(langSysCount)` is charged once, but `scripts.push` runs 65535 times with the same `langSysAt` array, and the loop at line 140 then runs 65535 × 65536 ≈ 4.3e9 `langSysSeen.has` iterations, unbudgeted. The face's parse hangs for minutes. It should cost budget per pushed record, or push each Script offset once.
- evidence: read
- severity: medium
- size: line
- cause: memoized Script still pushed once per record; outer loop not charged to `spend`
- confidence: sure

## PairPos subtables of a kern lookup are never charged to the work budget, so shared lookups expand without bound
- where: packages/font/src/outline/gposKerning.ts:203 (pairSubtables)
- scenario: a LookupList of 65535 entries all pointing at one lookup with 65535 type-2 subtable offsets, named by one `kern` feature (~400 KB total; the budget charges only the 65535 feature indexes and 65535 set indexes, well under 4 × bytes). `pairSubtables` runs for each of the 65535 distinct indexes and builds a 65535-entry array each time: ~4.3e9 iterations and tens of GB of arrays, so the parse hangs or runs out of memory. Even if it finished, `pairKerning` would walk all of them on every uncached pair. Subtable counts should go through `spend`, or subtables should be memoized by lookup offset rather than by index.
- evidence: read
- severity: medium
- fix: packages/font/src/outline/gposKerning.ts
- size: function
- cause: subtable count unbudgeted; memo keyed by index, not offset
- confidence: sure

## A `.ttc` whose member offsets all point at one large directory reads that directory once per member
- where: packages/font/src/outline/sfnt.ts:212 (membersOf)
- scenario: a 2 MB `ttcf` file: a 1 MB table directory with numTables 65535, and 262144 member offsets all pointing at it. `membersOf` calls `memberName` for every member, and each call runs `readTableDirectory`, building 65535 record objects: ~1.7e10 objects before any name is compared, which hangs the load. (Without the duplicates, members × tables is still unbounded relative to file size.) The sibling checks (`checkDistinctTables`, dfont `seen`) bound repeats like this, but name reading does not. Names should be memoized by `dirOffset`, or members that repeat a directory offset refused.
- evidence: read
- severity: medium
- size: function
- cause: per-member directory reread, no dedupe by directory offset
- confidence: likely

## Files read
packages/font/src/outline/OutlineFace.ts
packages/font/src/outline/cffCheck.ts
packages/font/src/outline/closeContours.ts
packages/font/src/outline/cmapCheck.ts
packages/font/src/outline/dataFork.ts
packages/font/src/outline/fontEmbedding.ts
packages/font/src/outline/fontFiles.fixture.ts
packages/font/src/outline/gposKerning.ts
packages/font/src/outline/localFonts.ts
packages/font/src/outline/opentypeParser.ts
packages/font/src/outline/outlineRegistry.ts
packages/font/src/outline/sfnt.ts
packages/font/src/outline/tag.ts
packages/font/src/outline/woff.ts
packages/font/src/outline/writtenFont.fixture.ts

<!-- done: 3 findings, files read: 15 -->
