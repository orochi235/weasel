## GPOS reader's work budget never counts subtables, so a small GPOS can still hang or exhaust memory in `pairSubtables`
- where: packages/font/src/outline/gposKerning.ts:191 (pairSubtables), called from readPairKerning:76
- scenario: The kern feature lists 65535 lookup indices (a 131 KB list). The LookupList has 65535 offsets, all pointing at one type-2 lookup whose subTableCount is 65535. `subtablesOf` is memoized by *index*, not by lookup offset, so every index walks and pushes all 65535 subtable offsets. That is ~4.3e9 reads and an array of ~4.3e9 numbers from a font of a few hundred KB, which is an OOM or hang during registration. After that, every `kernOf` call walks them all again. `workBudget` exists to stop exactly this case ("tables share one long list"), but `pairSubtables` never calls `spend`. It should charge `count` per lookup, or memoize by lookup offset so a shared lookup is walked once.
- evidence: read
- severity: medium
- fix: packages/font/src/outline/gposKerning.ts
- size: function
- cause: subtable walk outside the work budget
- confidence: likely

## A `.ttc` whose member offsets all name one huge directory makes `membersOf` read it once per member: quadratic work on a damaged file
- where: packages/font/src/outline/sfnt.ts:212 (membersOf → memberName → readTableDirectory)
- scenario: A ttcf header has numFonts = 250 000 (1 MB of member offsets), and every offset names the same directory with numTables = 65535 (1 MB of records). `membersOf` calls `memberName` for every member, and each call builds the full 65535-record array just to find `name`. That is ~1.6e10 record objects from a 2 MB file, a hang inside `sfntFromCollection` before any parser runs. The `.dfont` path refuses a resource named twice for this reason ("cannot copy more than the file"), but the ttcf path does not dedupe directory offsets, and does not bound records × members. It could memoize by `dirOffset`, or refuse two members sharing a directory.
- evidence: read
- severity: medium
- fix: packages/font/src/outline/sfnt.ts
- size: function
- cause: no dedupe of member directory offsets
- confidence: likely

## `checkCff` itself does quadratic work when many FDArray Font DICTs share one Private DICT's Subrs INDEX
- where: packages/font/src/outline/cffCheck.ts:52 (checkCff FDArray loop → checkFontDict → checkPrivate → readIndex)
- scenario: An FDArray INDEX holds 65535 small Font DICTs (~5 bytes each), each with a `Private` operator naming the same Private DICT, whose `Subrs` names one 65535-item INDEX (offSize 1 with zero-length items, ~64 KB). `readIndex` re-walks and re-allocates the 65535 items for every Font DICT: ~4.3e9 iterations from a CFF table of under 0.5 MB. The structural check meant to keep a damaged face from holding the thread becomes the hang. Checking each distinct `(at, size)` Private and each Subrs offset only once bounds it by the table size.
- evidence: read
- severity: low
- fix: packages/font/src/outline/cffCheck.ts
- size: function
- cause: shared Private/Subrs re-read per Font DICT
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
