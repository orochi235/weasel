# Audit round 76 — p-touch findings

## textObject gates `lineHeight` only for multi-line or wrapped text, but a single line's position also depends on it
- where: packages/p-touch/src/lbx/shapes.ts:173 (textObject)
- scenario: a one-line text command (no `\n`, `maxWidth` absent/Infinity) with `style.lineHeight: 2` and a `height` box. The canvas lays the line in a line box of `2 × fontSize` with CSS half-leading above the ascent (`halfLeadingFor` in packages/text/src/runs/resolveRuns.ts:134), so the glyphs sit about half a font size lower than at the default 1.2, and with `verticalAlign: 'center' | 'bottom'` the block's height (and so its offset in the box) changes too. `lines` is false, so the check is skipped and the command goes out as a `text:text` that P-touch sets with its own default spacing: the text lands higher in the file than on the canvas. The lineHeight check should apply to every text object (or at least whenever the line box height affects placement), not only to multi-line ones.
- evidence: read
- severity: medium

## Carried `.lbx` objects skip the along-tape bounds check every mapped object gets, so under auto length they grow the label
- where: packages/p-touch/src/lbx/writeLbx.ts:131 (collect, carrier branch)
- scenario: `autoLength: true`, length 100pt, and a `lbxObjectsCommand` placing a barcode at x = 150 (or at x = −20). A mapped rect/line/text at the same place fails `withinLength(o, end)` and goes to the rasterizer, which clips it to `[0, length]`; the carrier branch never calls `withinLength`, so the barcode is written as an object past the label's end and P-touch grows the label for it (the very case the `end` parameter's comment says must not happen), or places it before the label's start. The decision "an object outside `[0, end]` cannot go in as an object" is answered one way for mapped commands and another for carried ones; the carrier branch should skip such objects with a reason.
- evidence: read
- severity: medium

## Files read
packages/p-touch/src/index.ts
packages/p-touch/src/lbx/carried.ts
packages/p-touch/src/lbx/sceneLbx.ts
packages/p-touch/src/lbx/shapes.ts
packages/p-touch/src/lbx/style.ts
packages/p-touch/src/lbx/writeLbx.ts
packages/p-touch/src/pbt.fixture.ts
packages/p-touch/src/print.ts
packages/p-touch/src/render.ts
packages/p-touch/src/tape.ts

<!-- done: 2 findings, files read: 10 -->