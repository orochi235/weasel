# Audit round 78 — area `text`, blind reviewer

## measureTextBounds lays out without `justify` (or `alignWidth`), so a justified style measures narrower than it draws
- where: packages/text/src/measure/measureTextBounds.ts:39 (measureTextBounds)
- scenario: `measureTextBounds(text, { align: 'justify' }, { maxWidth: 200 })` on text that wraps into several lines. The layout options it builds carry `align`, `direction`, `tabSize`, `lineHeight` and `maxWidth`, but not `justify: style.align === 'justify'` or `alignWidth`, both of which `textPoseLayoutInput` (packages/text/src/layout/textPoseLayout.ts:49-57) passes. `placeLine` (layout/layoutLines.ts:261) spreads a wrapped line only when `justify` is set, so the node's renderer draws every wrapped line out to 200, while this function lays them out unspread and returns each line's natural width. The doc comment says it "mirrors `textCommand` exactly, so the returned bounds match what actually gets drawn". With `fitBox`, `shrinkScale` also gets the same incomplete options.
- evidence: read (compared against textPoseLayoutInput and placeLine)
- severity: low

## A run grammar marker with `repeat` 0 (or a non-integer or negative one) hangs `markdownToRuns`
- where: packages/text/src/runs/delimiterRuns.ts:11 (markersByDelimiter); the hang is at packages/text/src/runs.ts:300 (readRuns) and delimiterRuns.ts:48 (readRun)
- scenario: a custom grammar `{ markers: [{ delimiter: '~', repeat: 0, flags: ['underline'] }] }`. `markersByDelimiter` checks the delimiter (one UTF-16 unit, not a backslash) but never checks `repeat`. For any `~` in the input, `longestMarker` returns the repeat-0 marker, and `readRuns` advances `i += marker.repeat`, which is 0, so `markdownToRuns('a~b', grammar)` loops forever. `readRun`'s `count -= m.repeat` never terminates either, and `runsToMarkdown` reaches it through `readDelimiters`. With `repeat: 1.5`, `ch.repeat(1.5)` writes 1 unit and `i` becomes fractional, so `input[i]` reads `undefined` from then on. The delimiter is validated and throws a clear error; `repeat` should be held to a positive integer the same way.
- evidence: read
- severity: low

## Files read
packages/text/src/bakeTextFit.ts
packages/text/src/fitBoxToText.ts
packages/text/src/glyphOutlines.ts
packages/text/src/glyphTurn.ts
packages/text/src/hitTest.ts
packages/text/src/index.ts
packages/text/src/isTextData.ts
packages/text/src/joiningRuns.ts
packages/text/src/joiningTypes.gen.ts
packages/text/src/markdownRenderer.ts
packages/text/src/markdownText.ts
packages/text/src/measure/graphemes.ts
packages/text/src/measure/lineBoxes.ts
packages/text/src/measure/measureText.ts
packages/text/src/measure/measureTextBounds.ts
packages/text/src/measure/verticalAlign.ts
packages/text/src/pbt.fixture.ts
packages/text/src/pose.ts
packages/text/src/renderLabel.ts
packages/text/src/runs.ts
packages/text/src/runs/codePointCuts.ts
packages/text/src/runs/delimiterRuns.ts
packages/text/src/runs/effectiveRangeStyle.ts
packages/text/src/runs/flagRange.ts
packages/text/src/runs/rangeStyle.ts
packages/text/src/runs/resolveRuns.ts
packages/text/src/runs/smallCaps.ts
packages/text/src/runs/textTransform.ts
packages/text/src/syntheticBold.ts
packages/text/src/syntheticItalic.ts
packages/text/src/test-seams.ts
packages/text/src/textClusters.ts
packages/text/src/textStyle.ts
packages/text/src/textToPath.ts
packages/text/src/visualGraphemes.ts

<!-- done: 2 findings, files read: 35 -->
