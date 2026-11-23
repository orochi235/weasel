# Audit round 79, area font.outline

## A `.dfont` resource map can demand billions of slices: `sfntResources` bounds no work by the input
- where: packages/font/src/outline/dataFork.ts:63 (sfntResources)
- scenario: a map whose type list repeats an `sfnt` entry (65 536 entries of 8 bytes) with each entry naming the same reference list of 65 536 references (12 bytes each), all pointing at one resource. That map is about 1.3 MB, and every reference passes `inMap` and the data-segment checks. The nested loop then does 2^32 iterations, each running `bytes.slice` (a copy) and pushing to `out`. The parser hangs, or runs out of memory before the PostScript-name match in `sfntFromCollection` ever runs. A single type entry with 65 536 references to one multi-megabyte resource gives the same blowup on memory alone (65 536 copies). It should refuse a repeated type entry or repeated resource offsets (or slice lazily, as `membersOf` does for `.ttc` with `bytes: () => …`), and cap the work at what the map's bytes can hold. This is the same kind of hang `cffCheck`/`cmapCheck` exist to prevent.
- evidence: read
- severity: medium

## A collection member whose directory repeats one large table makes `extractFont` allocate the sum of every repeat
- where: packages/font/src/outline/sfnt.ts:121 (extractFont)
- scenario: a `.ttc` member directory with up to 65 535 records, all pointing at the same 5 MB `glyf` region. Each record passes `r.offset + r.length <= source.byteLength`, so `total` grows to about 320 GB. Then `new ArrayBuffer(total)` either throws a RangeError (not the "collection is truncated" error the rest of the file uses) or, below the engine's limit, allocates and copies gigabytes from a file of a few megabytes. Duplicate tags in one directory are invalid, and nothing refuses them.
- evidence: read
- severity: low

## An empty `postscriptName` counts as absent for `cssSrc` but as a name for the parser
- where: packages/font/src/outline/localFonts.ts:186 (enableLocalFontOutlines)
- scenario: for a local face whose `FontData.postscriptName` is `''`, `cssSrc` falls back to the bytes (`font.postscriptName ? … : undefined`), but `createOpenTypeParser('')` gets the empty string as a real name. In `opentypeParser.ts` that string is not `undefined`, so a `.ttc` member rejects with `no member … is named ""`, and a variable font fails the `fvar` default-instance check (`'' !== defaultName`). The same face then renders to DOM text and fails on the canvas. Both places should answer "is there a name" the same way: pass `font.postscriptName || undefined` to the parser.
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

<!-- done: 3 findings, files read: 15 -->
