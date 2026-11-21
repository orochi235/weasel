I couldn't write `.skulkr/out/findings.md` because the write was denied, so here is the whole document. The checkout is at `a22801b42b`, not the frozen commit, but `git diff` against b400d70 shows no differences under `packages/ui-logic/src`.

# Audit round 58 — ui-logic

## measureButton shrinks the label to any width, but the DOM label it claims to match cannot shrink below its min-content
- where: packages/ui-logic/src/button.ts:112-114 (measureButton)
- scenario: a button laid into a box narrower than its content, e.g. `{ label: 'Save changes' }` with `exactly(60, 28)`. measureButton narrows the label part, down to 0 if needed, and keeps it on one line. hud's button then ellipsizes the text into that rect. The DOM button it is held to behaves differently. ui's `Button.module.css` makes `.label` an `inline-block` flex item with the default `min-width: auto` and no `white-space: nowrap` or `overflow`, so it never goes below its min-content width. A multi-word label wraps to a second line, which the button's `overflow: hidden` clips. A single word keeps its full width and overflows both sides. The label rect measureButton reports matches neither DOM case.
- evidence: read (button.ts; ui Button.module.css `.label`/`.button`; hud/src/widgets/button.ts draw)
- severity: medium

## envNumber reads any CSS value by parseFloat, so a percentage or length line-height token is taken as a multiplier
- where: packages/ui-logic/src/measure.ts:72-75 (envNumber); used at menuPanel.ts:54 and rowList.ts:75
- scenario: `--wzl-leading-snug: 150%` (or `18px`) set on an element the DOM measure env reads. CSS's `line-height: var(--wzl-leading-snug)` in Menu/ItemList accepts it. `parseFloat('150%')` returns 150, so `lineHeight` becomes 150 × the font size (about 1950px at 13px) where the DOM draws 1.5×. Label rects and baselines land far outside the row. envPx is strict about this kind of value; envNumber should reject trailing units and fall back.
- evidence: read (the theme manifest types the token as a number, but envNumber does not check that)
- severity: low

## measureMenuPanel measures every label at weight 400, but the DOM draws a current row bold
- where: packages/ui-logic/src/menuPanel.ts:53,60-62,111 (menuPanelMetrics / MenuRowFace / measureMenuPanel)
- scenario: a menu whose widest row is current (`current: true`). The DOM draws it with `.current { font-weight: var(--wzl-font-weight-bold) }`. `MenuRowFace` has no way to mark a row bold, so its label is measured at 400. The measured panel comes out narrower than the DOM panel that `measure.browser.test.tsx` says matches it.
- evidence: read (menuPanel.ts; Menu.module.css `.current`; MenuRow.tsx:51-64; hud panelCommands.ts menuFace)
- severity: low

## measureRowList measures the empty state upright, but the DOM sets it in italic
- where: packages/ui-logic/src/rowList.ts:104 (measureRowList, empty branch)
- scenario: an empty list with `empty: 'No layers yet'`. The text is measured in `m.font`, and `FontSpec` has no style field. The DOM draws it with `.empty { font-style: italic }`, whose advance widths differ from upright, so the measured width and the empty rect differ from the DOM's.
- evidence: read (rowList.ts; ItemList.module.css `.empty`)
- severity: low

## Files read
packages/ui-logic/src/button.ts
packages/ui-logic/src/controlSize.ts
packages/ui-logic/src/focus.ts
packages/ui-logic/src/hold.ts
packages/ui-logic/src/index.ts
packages/ui-logic/src/measure.ts
packages/ui-logic/src/menuPanel.ts
packages/ui-logic/src/pbt.fixture.ts
packages/ui-logic/src/rowList.ts

<!-- done: 4 findings, files read: 9 -->