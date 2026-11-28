# Findings: text.layout (blind reviewer)

## Underline, strikethrough and overline run across a wrapped line's trailing spaces, past the aligned edge
- where: packages/text/src/layout/decorationMetrics.ts:120 (lineDecorations, `add`)
- scenario: an underlined English paragraph, `wrap` on, `align: 'right'` or `'center'`, e.g. "hello world again" wrapping after "hello ". The space that closes line 1 is in the same run and has a paint, so `add` joins it into the stretch and the rule runs to `g.x + g.step` of that space. `placeLine` hangs the space past the aligned edge (`hungWidth`), so the rule sticks out one space past the right edge of the box (and on the left in an RTL paragraph, where `hangsLeft` places the space). Every wrapped line of decorated text gets a rule tail with no ink above it. CSS's default (`text-decoration-skip-spaces: start end`) leaves spaces at the start and end of a line undecorated. The rule should stop at the line's last ink, i.e. leave out what `hungWidth` counts as hanging, and the same goes for leading white space.
- evidence: read
- severity: medium
- fix: packages/text/src/layout/decorationMetrics.ts, packages/text/src/layout/paintRuns.ts
- size: function
- cause: rule built from pen positions with no notion of hung white space
- confidence: likely

## `sum` in breakLines grows to the longest text ever laid out and never shrinks
- where: packages/text/src/layout/layoutLines.ts:93 (module `sum`), :146 (breakLines)
- scenario: lay out one 1,000,000-code-point document once (paste a long text into a text node). `sum = doubles(entries.length + 1)` replaces the module array with an 8 MB array of doubles, and nothing ever shrinks it, so the process holds that 8 MB for good after the text is gone. Every sibling scratch in this area is capped and falls back to a per-call array past a limit (`SCRATCH_MAX` in lineBreaks.ts and paintRuns.ts, `BREAK_SCRATCH_MAX` in wrapLines.ts, `JOINED_ENDS_MAX` in layoutEntries.ts, `POOL_MAX` for entries). This one is unbounded.
- evidence: read
- severity: low
- size: line
- cause: module scratch with no size cap
- confidence: sure

## A blank line in an `'auto'`-direction right-to-left text aligns as left to right
- where: packages/text/src/layout/layoutRuns.ts:262 (layoutRuns, `reads`); packages/text/src/layout/bidiLines.ts:76 (baseLevel)
- scenario: a bidi engine is registered, direction left at its default `'auto'`, `align: 'start'`, and the text is Hebrew or Arabic with a blank line between paragraphs ("שלום\n\nעולם"). Each text line reads `rtl` and sits at the right edge. The blank line has no entries, so `reads` falls back to level 0 → `'ltr'` → `'left'`, and its box (x0 = x1 = 0) and the caret placed on it sit at the far left. An RTL user who presses Enter twice sees the caret jump to the opposite edge. It should take a neighboring paragraph's direction (the one before, or the text's first, as `paragraphDirection` gives), not a hard-coded LTR.
- evidence: read
- severity: low
- size: function
- cause: blank line has no paragraph, defaults to level 0
- confidence: likely

## Justify widens only U+0020 gaps, not no-break spaces between words
- where: packages/text/src/layout/layoutLines.ts:236 (wordGaps)
- scenario: justified French text such as "Quoi ? Pourquoi ! Oui : non" with U+00A0 before the punctuation (standard French typography) gets no extra width at the NBSP gaps, while CSS counts U+00A0 as a word separator for `text-justify` and spreads it like the other gaps. The gaps around each piece of punctuation end up visibly narrower than the ones next to them on the same justified line.
- evidence: read
- severity: low
- size: line
- cause: word separator set is only U+0020
- confidence: likely

## LB20a does not keep a word-initial hyphen with a following Hebrew letter
- where: packages/text/src/layout/lineBreak/lineBreaks.ts:199 (decide, LB20a)
- scenario: Hebrew text with a hyphen at the start of a word (" -שלום"): the rule checks `B === AL` only, so with HL after the hyphen it falls through to LB21/LB31 and may allow a break after the leading hyphen. UAX #14 16.0 (the table's version) states LB20a as `× (AL | HL)`.
- evidence: read
- severity: low
- size: line
- cause: rule's right side missing HL
- confidence: likely

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

<!-- done: 5 findings, files read: 31 -->
