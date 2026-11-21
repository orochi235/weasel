# Audit round 58, area ui-logic

Note: the brief names frozen commit b400d7039e8ac2f03166b3332ac613eba61c689f, which is not in this repo
(`git cat-file` says "bad object"). This review read the tree at HEAD a22801b42b. `packages/ui-logic` has no
uncommitted changes there.

## measureMenuPanel sizes every label at weight 400, but the DOM menu draws the current row bold
- where: packages/ui-logic/src/menuPanel.ts:53 (menuPanelMetrics), :111 (measureMenuPanel)
- scenario: a menu with a `.current` row (Menu.module.css:32 `font-weight: var(--wzl-font-weight-bold)`) and a long label that sets the panel's width. The DOM panel grows to fit the bold advance. measureMenuPanel measures that label in `m.font` (weight 400), so the HUD panel comes out narrower than the DOM one, and the HUD's label rect is short of its text. `MenuRowFace` has no field for weight, so a caller can't pass it. The two targets should give the same box.
- evidence: read (menuPanel.ts and Menu.module.css; I did not check which DOM rows get `s.current`)
- severity: low

## nestHold carries an outer hold's reason in even while that outer hold is off
- where: packages/ui-logic/src/hold.ts:22 (nestHold)
- scenario: `nestHold({ on: false, reason: 'Locked' }, true)` returns `{ on: true, reason: 'Locked' }`. The doc says "A level's `reason` counts only while that level is `on`". `Hold` is public, and a caller building one from props (`{ on: disabled, reason: disabledReason }`, the way buttonTooltip.tsx:72 builds its argument) produces exactly that input. The result should be `{ on: true }`. The fix is `reason || (outer.on ? outer.reason : undefined)`.
- evidence: read
- severity: low

## controlAccess counts an empty reason as a reason, but nestHold treats it as none
- where: packages/ui-logic/src/hold.ts:41 (controlAccess) vs :22 (nestHold)
- scenario: nestHold drops `''` (`reason || outer.reason`). controlAccess tests `disabled.reason !== undefined`, so `controlAccess({ on: true, reason: '' })` returns `reachable: true, reason: ''`. The control stays focusable and hoverable and gets an empty tooltip. It should leave the tab order, as a disabled control with no reason does. The two halves of one rule answer the same input differently.
- evidence: read
- severity: low

## measureRowList measures the empty state upright, but ItemList sets it in italic
- where: packages/ui-logic/src/rowList.ts:104 (measureRowList)
- scenario: a list with no rows and `UNBOUNDED` constraints. ItemList.module.css:97 sets `.empty { font-style: italic }`. The measure calls `env.text(empty, m.font)`, and `FontSpec` has no style field, so the width comes from upright metrics. The HUD box and the DOM box differ by the italic advance.
- evidence: read
- severity: low

## runs() passes a fractional or infinite WEASEL_PBT_RUNS straight to fast-check
- where: packages/ui-logic/src/pbt.fixture.ts:6 (runs)
- scenario: `WEASEL_PBT_RUNS=2.5` gives `numRuns: 2.5`, and `WEASEL_PBT_RUNS=Infinity` passes `deep > 0`, so every property runs without end and `timeoutFor` returns `Infinity`. The value should be floored and checked with `Number.isFinite`.
- evidence: read
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

<!-- done: 5 findings, files read: 9 -->
