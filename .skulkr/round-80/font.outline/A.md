## GPOS reader's feature/LangSys walk is unbounded: a crafted ~0.5 MB font hangs or exhausts memory at load
- where: packages/font/src/outline/gposKerning.ts:42 (gposPairKerning), :88 (lookupIndexSets)
- scenario: a GPOS FeatureList of 65,535 records, every one tagged `kern` and pointing at one shared Feature table
  whose lookupIndexCount is 65,535 (records 393 KB + indices 131 KB, all in range). `gposPairKerning` builds
  `kernLookups` with 65,535 arrays of 65,535 numbers (~4.3e9 entries) before anything is deduplicated, which holds the
  main thread and then runs out of memory. The ScriptList walk compounds the same way: 65,535 ScriptRecords sharing
  one Script table with 65,535 LangSys records, each naming 65,535 features, recomputes a lookup set per LangSys
  (only the push is deduplicated, by `seen`), ~2.8e14 steps. `createOpenTypeParser` calls this on every face load,
  after `checkCff`/`checkCmap`, which exist precisely to refuse a small file that holds the parser. Should: bound the
  work by the table's size (dedupe feature offsets / LangSys offsets before expanding, or cap the total indices read),
  or refuse the face, as the CFF and cmap checks do.
- evidence: read
- severity: medium

## WOFF inflation is bounded only by each table's declared `origLength`, not by anything tied to the file
- where: packages/font/src/outline/woff.ts:34 (sfntFromWoff), :71 (inflate)
- scenario: a WOFF whose table records declare `origLength` near 4 GB over a few MB of deflate data (zlib reaches
  ~1000:1). `inflate` reads up to `limit = origLength` bytes, collecting every chunk, then allocates `new Uint8Array(length)`
  and copies — roughly twice the declared size resident — before the length check can refuse anything; the rebuilt sfnt
  allocates it a third time. A few-MB file takes the tab down. The comment says "a small table can inflate without
  bound", but the bound chosen is the attacker's number. Should: cap the total declared size (e.g. against the header's
  `totalSfntSize` and a sane multiple of the file length) before inflating.
- evidence: read
- severity: low

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

<!-- done: 2 findings, files read: 15 -->
