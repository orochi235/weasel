## WOFF table inflation has no bound until it finishes, so a small damaged or hostile table can exhaust memory
- where: packages/font/src/outline/woff.ts:31 (sfntFromWoff) and :62 (inflate)
- scenario: a WOFF table records `origLength` 4 KB and `compLength` 2 KB, but its zlib stream inflates to gigabytes (a deflate bomb, or a damaged stream that happens to be one). `inflate` keeps every chunk and concatenates them; the `data.byteLength !== origLength` check runs only after the whole stream has been read. The tab runs out of heap before the "damaged" error can fire. It should stop reading, and cancel the reader, as soon as `length` passes `origLength`. The neighboring cmap and CFF checks exist to stop exactly this kind of damaged-byte heap exhaustion.
- evidence: read
- severity: medium

## A warn-once key is the variant, not the registration, so a re-registered face that fails again warns nothing
- where: packages/font/src/outline/outlineRegistry.ts:276 (runLoad) and :218 (glyphOutline)
- scenario: `registerFontOutlines('X', {}, badUrl)` loads and fails, which warns under `load|X|400|normal`. The consumer fixes the URL by registering again, and the new source fails too (wrong file, a WOFF2). The `warned` set already holds that key, so the second failure is silent. The same happens when a registration replaced mid-load fails: it uses up the key for a registration that no longer exists, and the real one's failure is never reported. The `glyph|…` key has the same problem for a different font registered under the same variant. The key should be the slot (or cleared when a variant is re-registered).
- evidence: read
- severity: low

## A DOM-only read of a Blob or thunk source keeps a copy of the bytes for the registration's whole life
- where: packages/font/src/outline/outlineRegistry.ts:335 (readSlot via outlineCssSource `bytes`)
- scenario: a face registered from a Blob (or a thunk) with no `cssSrc` is asked for by DOM text first. `readSlot` stores the read in `slot.read`. The field's doc says it is dropped "when the load settles", but if the canvas never asks for that face (text below the outline threshold), no load runs. The resolved ArrayBuffer then stays pinned beside the Blob until the slot is unregistered. For a collection-sized face that is tens of MB held for nothing. It should be dropped once the read resolves and has been handed over.
- evidence: read
- severity: low

## GPOS lookup indexes are not checked against LookupList's count, so a bad index reads another table's bytes as a lookup
- where: packages/font/src/outline/gposKerning.ts:143 (pairSubtables)
- scenario: a `kern` feature names lookup index 40 in a LookupList whose `lookupCount` is 12. `v.getUint16(lookupList + 2 + index * 2)` reads whatever follows the offset array (a lookup table's header bytes) as an offset. When that lands on bytes that parse as type 2, it returns spurious kerning for pairs, where it should skip the index as out of range. Every other overrun here is skipped as "applying to no pair". The same goes for `covIndex` against `pairSetCount` in pairValue format 1 (line 238).
- evidence: read
- severity: low

## `.dfont` type and reference counts handle the stored-minus-one 0xffff two different ways
- where: packages/font/src/outline/dataFork.ts:65 and :73 (sfntResources)
- scenario: the type-list count wraps 0xffff to 0 (`(n + 1) & 0xffff`, commented "an empty list reads as 0xffff"). A type entry's reference count of 0xffff is instead read as 65536 references. The fork then reads past its map and throws "truncated" rather than yielding no resources of that type. The same encoding is answered two ways.
- evidence: read
- severity: low

## Local fonts quote their `local()` name with JSON.stringify, not the package's CSS string quoter
- where: packages/font/src/outline/localFonts.ts:166 (enableLocalFontOutlines)
- scenario: `cssString` (`../cssFamily`) is the package's way to quote a CSS string, and outlineRegistry uses it for `url(…)`. localFonts uses `JSON.stringify` instead, whose `\n`, `\t` and `\uXXXX` escapes are not CSS escapes: in CSS, `\n` reads as a literal `n`. A PostScript name holding a control or non-ASCII character (damaged or non-conforming `name` data) gets a `local()` that names a different face. The same decision is answered in two places.
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

<!-- done: 6 findings, files read: 15 -->
