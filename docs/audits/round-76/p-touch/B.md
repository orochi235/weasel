# Audit round 76, area `p-touch`

## A single-line text box at a non-default lineHeight is written as an object, though its line sits off P-touch's position
- where: packages/p-touch/src/lbx/shapes.ts:175 (textObject)
- scenario: a text command holding one unwrapped line (`maxWidth: Infinity`, no hard break) with `style.lineHeight: 3` and `verticalAlign: 'top'` (or `'bottom'`). The canvas sets the line `fontSize * 3` tall and puts the glyphs half the leading below the box top (layoutRuns: "half the leading above the ascent"), so they sit 0.9 × fontSize lower than at the default 1.2. The lineHeight guard runs only when `lines` is true (a `\n` or a finite `maxWidth`), so this box becomes a `text:text`, and P-touch, which the writer assumes spaces lines as the default does, draws the text at the box top. The printed text lands about a font size higher than on the canvas, and at `bottom` about as far lower. A line height under the default moves it the other way. The guard should apply whenever the vertical alignment is not `center`, not only to multi-line boxes. (The 2026-11-20 ruling in docs/unruled.md covers only boxes that set more than one line.)
- evidence: read (layoutRuns.ts:15-22 for the half-leading placement; that P-touch's own leading matches the default is the writer's stated premise)
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

<!-- done: 1 findings, files read: 10 -->
