# Audit round 50 — hud.menu (blind reviewer)

## A color picker's Hex row shows, and compares against, the last text typed rather than the color the picker holds
- where: packages/hud/src/menu/colorPicker.ts:57 (withColorPickers, `hex` entry); read through packages/hud/src/menu/menuWidget.ts:200 (`text: c.textValue`) and packages/hud/src/menu/textEdit.ts:224 (`start`)
- scenario: the Hex row's `value` getter returns `now()` (the picker's color), but every reader goes through `c.textValue(hex)`, which `createHeld` (packages/menu/src/heldValues.ts:9) answers from its own map once `setText` has written that row. Open a Fill picker, type `f00` + Enter in Hex (color → `#ff0000`; the held text for the Hex row is `f00`), then press the blue swatch (color → `#1e88e5`). The Hex row still draws `f00`, its accessible label reads `Hex: f00`, and pressing it starts the edit from `f00`, not `#1e88e5`. Worse, typing `f00` + Enter again does nothing: `write` returns early because `'f00' === valueOf(hex)`, so the color stays blue instead of going back to red. Invalid text (`zzz`) is also held and shown though no color was written. The Hex row should always show and start from the picker's current color, and a typed value should always reach `hex.set`.
- evidence: read
- severity: medium

## A text row's edit survives its submenu closing, so keys go to an invisible edit and the menu cannot be navigated
- where: packages/hud/src/menu/menuWidget.ts:137 (`c.subscribe(() => { replace(); rev.changed(); })`) and :89 (menuKey)
- scenario: `typing.leave` runs only when a row is chosen (line 170) and on dispose. Open a color picker submenu, click its Hex row (the edit starts), then move the pointer onto another row of the parent panel: `hover` → `hoverNow` sets the stack to `[j]`, which closes the submenu. `typing.current()` still holds the Hex edit, `menuTextInput.read` returns null (the row is on no open level), and `menuKey` sends every key to `typing.key` first, which consumes all of them: ArrowUp/Down move a caret nobody can see instead of the menu's highlight, letters change a hidden draft, and Enter writes it to a row that is not shown. The DOM menu's field unmounts with its submenu and blurs, committing; here the edit should end (blur rule, `typing.leave()`) as soon as its row is no longer on an open level.
- evidence: read
- severity: medium

## A picker's swatches draw in the alpha the row opened with but write the alpha held now
- where: packages/hud/src/menu/colorPicker.ts:42 (withColorPickers, `value` vs `writes`)
- scenario: for an `alpha: true` color row opened at `#33669980`, every swatch's drawn color is fixed at open as `hexColor(color, true, e.value)` (alpha `80`), while choosing it writes `hexColor(color, true, now())`. Type `#33669920` into Hex (alpha now `20`): the swatches still draw at alpha `80`, yet pressing the red swatch writes `#e5393520`, and its check mark is computed against the `20` form. The swatch shown should be the color it writes (computed from `now()` when drawn, as `checked` already is).
- evidence: read
- severity: low

## Typed text longer than its row draws outside the panel, over the label and past the panel's left edge
- where: packages/hud/src/menu/valueRows.ts:101 (typingCommands); packages/hud/src/menu/panelCommands.ts:162
- scenario: a text row's trailing column is sized once at open from `e.value` (valueRowWidth, min 7em), and the panel is not re-placed while typing. `typingCommands` right-aligns the draft against `typedRight` with no clip or scroll (`textCommandFromRuns` gets no `maxWidth`, only an alignment `width`), and `typedLine` lays the line out to a negative `left`. Typing 40 characters into a default-width row draws the draft over the row's label and then outside the panel's rounded face onto the canvas, with the selection rects and caret following it. The DOM field scrolls its text inside the field; the HUD row should keep the draft within the row (scroll it so the caret stays visible, or clip).
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
