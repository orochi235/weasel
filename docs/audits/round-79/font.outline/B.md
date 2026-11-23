## A CFF table whose header byte reads 2 skips every structural check, so the parser hang `checkCff` exists for is still reachable
- where: packages/font/src/outline/cffCheck.ts:31 (checkCff)
- scenario: a `CFF ` table (or a `CFF2` one) whose major-version byte is 2 — a real CFF2 face with a damaged Top DICT, or a CFF 1 face whose first byte a damaged byte turns from 1 to 2 — returns from `checkCff` unread. opentype.js then reads it by that header (the parser's own comment says "reads either by the version its header names"), following Top DICT offsets for CharStrings, FDArray and Private exactly as the module comment describes for CFF 1; an offset operator holding the wrong operand count reaches the same string-offset INDEX read that held the parser for a minute. Should: the CFF2 header, Top DICT and the INDEXes it names get the same bounds/operand checks, or a version-2 header is refused, rather than passing everything.
- evidence: read (the hang through CFF2 parsing in opentype.js is inference from the module comment, not run)
- severity: medium

## `advanceOf` lets a CFF charstring parse throw into layout, unguarded, while `glyphD` for the same glyph is caught
- where: packages/font/src/outline/opentypeParser.ts:93 (createOutlineFace → advanceOf); also :178 (embeddingOf → advanceOfGlyph)
- scenario: in opentype.js a CFF glyph's `advanceWidth` is a dependent property of its lazily parsed `path`, so reading it runs the charstring. A damaged charstring that throws while parsing (e.g. a subroutine that calls itself, which opentype.js follows without a depth limit → RangeError) makes `advanceOf(cp)` throw. `glyphOutline` wraps `glyphD` in try/catch and serves SDF for that one glyph, but `advanceOf` is called straight from the layout metric source (`glyphMetrics.ts:76`) with no catch, so one bad glyph throws out of text layout for the whole run instead of costing that glyph. Should: answer the same way `glyphD` does — treat the glyph as unusable (null) rather than throwing.
- evidence: read (opentype.js's lazy advance and unbounded subr recursion are inference from its source as I recall it, not run here)
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

<!-- done: 2 findings, files read: 15 -->
