# Audit round 80 — font.outline (blind reviewer)

## WOFF unpacking copies repeated and overlapping table records, which `.ttc` and `.dfont` refuse
- where: packages/font/src/outline/woff.ts:23 (sfntFromWoff)
- scenario: a WOFF file whose directory lists N records (up to 65535), all with the same `offset` pointing at one
  compressed block, or the same tag listed twice. Each record is inflated separately (up to its own `origLength`,
  which can be 2^32 − 1) and every result is kept in `tables` before the output is allocated. A file of a few MB can
  then inflate to N × its expanded size and run the tab out of memory, where the parser should refuse it as damaged.
  For `.ttc` members, `checkDistinctTables` (sfnt.ts) refuses a table listed twice or tables sharing bytes "so a
  member's copy is no larger than its file", and `.dfont` refuses overlapping `sfnt` resources (unruled.md, round 79).
  WOFF, the third container, answers the same question the other way: it has no tag-uniqueness check, no overlap
  check on the compressed ranges, and no cap on total output (the header's `totalSfntSize` is never read).
- evidence: read
- severity: medium

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

<!-- done: 1 findings, files read: 15 -->
