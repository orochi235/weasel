# Audit round 78 — area `text` (blind reviewer)

## effectiveRangeStyle reports italic (and every override key) as MIXED across runs that all render the same
- where: packages/text/src/runs/effectiveRangeStyle.ts:76 (effectiveRangeStyle), with packages/text/src/runs/rangeStyle.ts:131 (styleAtRange)
- scenario: node `style.fontStyle: 'italic'`, runs `[{ text: 'ab' }, { text: 'cd', italic: true }]`, range [0, 4). `styleAtRange` compares the raw `undefined` against `true` and reports `italic: MIXED`; `effectiveRangeStyle` takes `range.italic ?? node` and returns `MIXED`, though both runs render italic (an absent `italic` inherits the italic node). The same happens upright: an upright node with runs `undefined` and `italic: false`. The OVERRIDES loop has the same gap: runs with `fontFamily` absent and `fontFamily` equal to the node's family read as `MIXED`. Each should be resolved against the node per run before the runs are compared, as `rangeWeight` does for bold/fontWeight, so a toolbar reading this shows Italic as on rather than mixed.
- evidence: read
- severity: medium

## measureTextBounds lays out without `justify` and `alignWidth`, unlike every text pose reader
- where: packages/text/src/measure/measureTextBounds.ts:39 (measureTextBounds)
- scenario: `measureTextBounds(text, { align: 'justify' }, { maxWidth: 200 })`, or the same with `fitBox`. The options it builds carry `align: 'justify'` but no `justify: true` and no `alignWidth`, while `textPoseLayoutInput` (packages/text/src/layout/textPoseLayout.ts:49) sets both, and `resolveAlign` says that whether lines are spread is carried only by `LayoutRunsOptions.justify`. So the measurement, and the shrink factor `shrinkScale` finds for `fitBox`, come from an unjustified layout, which differs from what a node with that style draws. The doc's claim that it "mirrors `textCommand` exactly" does not hold for justified text.
- evidence: read (the effect on `bounds` is inferred; layoutRuns' justify path not read)
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
