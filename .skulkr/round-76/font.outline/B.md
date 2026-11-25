# Audit round 76 — font.outline findings

## WOFF tables inflate without a bound: a small table that decompresses huge exhausts memory before the length check
- where: packages/font/src/outline/woff.ts:31 (sfntFromWoff), packages/font/src/outline/woff.ts:62 (inflate)
- scenario: a WOFF file (fetched from a URL source or handed in as bytes) whose table records `origLength` 1000 but whose zlib stream inflates to gigabytes. `inflate` collects every chunk the DecompressionStream yields and only after the stream ends does `sfntFromWoff` compare `data.byteLength !== origLength`. The tab allocates until the heap runs out. It should stop reading, and cancel the reader, as soon as `length` passes the recorded `origLength`, and throw `damaged(...)`. The neighboring cmap and CFF checks exist to stop exactly this kind of heap exhaustion from damaged bytes.
- evidence: read
- severity: medium

## `embeddable` refuses fonts whose fsType sets Restricted alongside a less restrictive bit
- where: packages/font/src/outline/opentypeParser.ts:166 (embeddingOf, NO_OUTLINE_EMBEDDING)
- scenario: an OS/2 version 0–2 font with fsType 0x0006 (Restricted plus Preview & Print) or 0x000A (Restricted plus Editable). The OpenType spec says to apply the least restrictive permission set, so the font is embeddable. The code tests `fsType & 0x0002` and reports `embeddable: false`, so a PDF export refuses to embed it. Bit 1 should count only when bits 2 and 3 are both clear.
- evidence: read (spec semantics from memory of the OS/2 fsType definition)
- severity: low

## A GPOS `kern` feature with no readable pair lookups suppresses the legacy `kern` table
- where: packages/font/src/outline/gposKerning.ts:57 (gposPairKerning); packages/font/src/outline/opentypeParser.ts:105 (kernOf)
- scenario: a font has a GPOS `kern` feature whose lookups are all contextual or chained, or whose PairPos subtables run past the file so `pairSubtables` skips them, and it also has a legacy `kern` table. `kernLookups.size > 0`, so `gposPairKerning` returns a function even though `lookupSets` is empty. `kernOf` then takes the `if (gpos)` branch and answers 0 for every pair, and never reaches `font.getKerningValue`, which would read the `kern` table. The doc says `null` means "the caller then falls back"; it should also return `null` when `lookupSets` is empty.
- evidence: read
- severity: low

## The per-face glyph memo has no bound
- where: packages/font/src/outline/outlineRegistry.ts:228 (glyphOutline, `slot.glyphs`)
- scenario: a registered CJK face, or any face asked for many distinct code points (a long document, or a text field the user types arbitrary text into), keeps a `glyphs` entry for every code point ever asked. Misses are stored as `null`, and a hit stores the full path string, often kilobytes for a CJK glyph. These entries are dropped only when the registration goes away. Tens of thousands of glyphs come to tens of MB per face. The GPOS pair memo in the same tier is capped at 4096 entries (`PAIR_MEMO_LIMIT`); this cache has no cap.
- evidence: read
- severity: low

## The `local(...)` src is quoted with JSON.stringify rather than the package's CSS string quoting
- where: packages/font/src/outline/localFonts.ts:170 (enableLocalFontOutlines, `cssSrc`)
- scenario: the registry quotes a URL source with `cssString` (cssFamily.ts), while this path quotes the PostScript name with `JSON.stringify`. The two disagree on control characters. JSON writes `\u0001`, which CSS reads as the escaped letter `u` followed by `0001`, so the name changes. They also disagree on any character JSON escapes with `\uXXXX`. So the same decision, how to write a CSS string, is answered in two places. With an ASCII-printable PostScript name the two give the same result; a malformed name from `queryLocalFonts` produces a `local()` that names a different face. It should use `cssString`.
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

<!-- done: 5 findings, files read: 15 -->
