# Audit round 78 — font.outline — blind reviewer findings

## `FaceEmbedding.embeddable`'s doc says bit 1 always forbids embedding, but the parser allows it for OS/2 v0–2 fonts
- where: packages/font/src/outline/OutlineFace.ts:66 (FaceEmbedding.embeddable), against packages/font/src/outline/opentypeParser.ts:151 (outlinesEmbeddable)
- scenario: an OS/2 version 2 font with fsType 0x0006 (Restricted plus Preview & Print). The interface doc says `embeddable` is false whenever bit 1 (0x0002) is set. `outlinesEmbeddable` returns true, because it applies the pre-v3 rule that the least restrictive bit wins. A consumer that reads the public contract and checks `fsType & 2` itself gets the opposite answer from the field. The two answers to one decision disagree, and the doc is the one that's wrong.
- evidence: read
- severity: low

## An unmatched collection member is reported as a truncation error when the first member is damaged
- where: packages/font/src/outline/sfnt.ts:180 (sfntFromCollection)
- scenario: a `.ttc` that has no member named `postScriptName`, and whose first member has a table running past the end of the file. `sfntFromCollection` still calls `members[0].bytes()` before returning `matched: false`, so `extractFont` throws `font collection is truncated: table "…"`. The parser's `no member of the font file is named "…" (it holds …)` error is never reached. The face fails with an error that doesn't name the real problem, which is a wrong PostScript name, and a whole member is copied for nothing on every miss. When `matched` is false, member 0 should not be extracted.
- evidence: read
- severity: low

## `parseFontStyle` and `styleQualifierCount` decide "is this word a weight or slant" differently
- where: packages/font/src/outline/localFonts.ts:84 (parseFontStyle) and :101 (styleQualifierCount)
- scenario: `joinWeightWords` closes `extra|ultra|semi|demi` up against any following word, not only a weight. "Demi Italic" becomes `demiitalic`, and "Ultra Thin" becomes `ultrathin`. `parseFontStyle` finds the weight by substring (`demi` gives 600, plus italic; `thin` gives 100), but `styleQualifierCount` compares whole words, so it counts `demiitalic` and `ultrathin` as one non-weight qualifier each. When two faces land on one slot, a plain "Demi Italic" ties with, or loses to, a genuinely qualified face such as "Condensed Demi Italic" (which also scores 1), and query order picks the slot's face. Both functions should use one word test.
- evidence: read
- severity: low

## A DOM read started after the load has settled holds the font's bytes for the life of the registration
- where: packages/font/src/outline/outlineRegistry.ts:356 (readSlot), with outlineCssSource :329
- scenario: a Blob or thunk registration with no `cssSrc`, whose canvas load settled before DOM text asked. For example, `domFace` was imported after the face loaded, so `announceBytes` had no listener, or `domFonts()` was false at the time. `ensureFace` then calls `css.bytes()`, and `readSlot` reads the source a second time (calling the thunk again) and stores it in `slot.read`. Only `runLoad` ever clears `read` on success, and it has already run, so a second full copy of the file stays pinned until the face is unregistered. The `read` field's doc says it is "dropped when the load settles"; a read started after that point is never dropped.
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

<!-- done: 4 findings, files read: 15 -->
