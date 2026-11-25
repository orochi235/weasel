# Audit round 50, area hud.menu (reviewer findings)

## A text row's edit survives its submenu closing, swallowing keys into a row no longer on screen
- where: packages/hud/src/menu/menuWidget.ts:146 (createMenuWidget `pointer`), :89 (menuKey)
- scenario: a text row sits in a submenu. Click it (typing starts), then move the pointer onto another row of the parent panel; `c.hover` closes the submenu after its delay. Nothing calls `typing.leave` on hover or on a stack change (only a chosen release and `dispose` do), so the edit stays live on an entry no panel shows: `menuTextInput.read` returns null (no caret rect for the IME), every key still goes to `typing.key` first and returns true, so arrows/Space/letters don't drive the menu, typed characters land in the hidden row, the first Escape only cancels that invisible edit, and Enter writes the hidden row. The DOM menu's field unmounts with its panel and blurs, which keeps what was typed and ends the edit; the HUD menu should end the edit the same way (`typing.leave()` once its entry is in no open level).
- evidence: read
- severity: medium

## `attachMenuHost` with `toCanvas: undefined` or `canvasSize: undefined` throws instead of using the hud's
- where: packages/hud/src/menu/attachMenuHost.ts:20 (attachMenuHost)
- scenario: `opts = { toCanvas: hud.toCanvas, canvasSize: hud.canvasSize, ...options }`. The options type is `Partial<Pick<…>>` and the repo's tsconfigs set no `exactOptionalPropertyTypes`, so a caller forwarding its own optional props (`attachMenuHost(hud, host, { toCanvas: props.toCanvas })`) type-checks; the spread overwrites the default with `undefined`, and the first open (`createMenuWidget` calling `opts.toCanvas` / `opts.canvasSize`) or wheel outside (`outside` calling `opts.toCanvas`) throws "not a function". The documented default should hold for an explicitly undefined field (`options.toCanvas ?? hud.toCanvas`).
- evidence: read
- severity: low

## A color picker's swatches draw in the alpha the row opened with, not the alpha it holds now
- where: packages/hud/src/menu/colorPicker.ts:42 (withColorPickers `picker`)
- scenario: an `alpha: true` color row opens holding `#00000080`. Each swatch's drawn color is fixed at build time as `hexColor(color, alpha, e.value)`, so `#e53935` draws as `#e5393580`. Type `#123456ff` into the Hex row: the held alpha is now `ff`, choosing a swatch writes `#e53935ff` (`writes(now())`) and the checked test compares against that, but every swatch still draws at alpha 80. The swatch shows a color other than the one choosing it writes; the row's swatch should read `writes(now())` live, as the submenu's own swatch reads `now`.
- evidence: read
- severity: low

## A color picker's swatch rows are exposed as checkboxes, though choosing one unchecks the rest
- where: packages/hud/src/menu/colorPicker.ts:44 (withColorPickers row), packages/hud/src/menu/accessibleMenu.ts:26 (level)
- scenario: each swatch row is an `item` with a `checked` getter and no `radio: true`, so `accessibleMenu` gives it role `menuitemcheckbox`. The swatches are mutually exclusive: at most one is checked, and choosing one moves the check. A screen reader announces independent checkboxes, and checking one silently unchecks another. They should carry `radio: true` (role `menuitemradio`).
- evidence: read
- severity: low

## Files read
packages/hud/src/menu/accessibleMenu.ts
packages/hud/src/menu/attachMenuHost.ts
packages/hud/src/menu/chipRepeat.ts
packages/hud/src/menu/colorPicker.ts
packages/hud/src/menu/menu.fixture.ts
packages/hud/src/menu/menuEnv.ts
packages/hud/src/menu/menuWidget.ts
packages/hud/src/menu/panelCommands.ts
packages/hud/src/menu/placePanels.ts
packages/hud/src/menu/textEdit.ts
packages/hud/src/menu/textWidth.ts
packages/hud/src/menu/typedLine.ts
packages/hud/src/menu/valueRows.ts

<!-- done: 4 findings, files read: 13 -->
