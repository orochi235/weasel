# Audit round 56 — ui-logic (blind reviewer)

Read at the checkout's HEAD a22801b42b; the brief's b8bed07d81 is not in this clone, and `packages/ui-logic` has no
uncommitted changes against HEAD.

## measureMenuPanel sizes a `current` row in weight 400, but the DOM menu sets it bold, so the two panels' widths disagree
- where: packages/ui-logic/src/menuPanel.ts:53 (menuPanelMetrics), :110-111 (measureMenuPanel); `MenuRowFace` at :60-62
- scenario: a menu whose widest row is an item with `current: true`. `MenuRow.tsx:64` gives that row `.current`, and
  `Menu.module.css:32` sets it to `font-weight: var(--wzl-font-weight-bold)`, so the DOM panel grows to fit the bold label.
  `MenuRowFace` cannot say a row is bold, and every label is measured in `m.font`, which is weight 400. The HUD panel
  from `measurePanel` (hud `panelCommands.ts:48`) comes out narrower than the DOM panel for the same entries. The
  file's own header says "Every length here is one `menuPanelMetrics` … reads". The row face should carry the weight,
  or `current`, and measuring should use the bold weight for that row.
- evidence: read
- severity: low

## nestHold takes the reason of an outer hold that is off
- where: packages/ui-logic/src/hold.ts:22 (nestHold)
- scenario: `nestHold({ on: false, reason: 'Locked layer' }, true)` returns `{ on: true, reason: 'Locked layer' }`. The
  doc on the function says "A level's `reason` counts only while that level is `on`". A host that builds a scope's
  `Hold` as `{ on: props.disabled, reason: props.disabledReason }` with the reason always set (an exported public type
  invites this) passes it in as `outer`, and an inner control disabled with no reason of its own is then reachable and
  shows the outer scope's reason, even though that scope is not disabled. The fix is `reason || (outer.on ? outer.reason : undefined)`.
  The in-tree callers (`Disabled.tsx`) only nest holds made by `nestHold`, so they never hit this.
- evidence: read
- severity: low

## controlAccess treats an empty reason as a reason, though nestHold treats it as none
- where: packages/ui-logic/src/hold.ts:41 (controlAccess) vs :22 (nestHold)
- scenario: `controlAccess({ on: true, reason: '' })` returns `reachable: true, reason: ''`. The control stays in the
  tab order and keeps a tooltip that says nothing. `nestHold(…, true, '')` normalizes the same `''` to no reason
  (`reason || outer.reason`), and that holds it out of the tab order. So the question "does this hold have a reason?"
  gets two different answers in the same file. Any caller that hands `controlAccess` a hand-built `Hold` hits it, for
  example `useButtonAccess` if its source ever passes a raw prop through. The test should be `!!disabled.reason`.
- evidence: read
- severity: low

## envNumber reads a keyword font weight as the fallback, not the weight CSS draws
- where: packages/ui-logic/src/measure.ts:72-75 (envNumber), used by button.ts:81 (buttonMetrics)
- scenario: a theme sets `--wzl-button-font-weight: normal` (or `bold`). The DOM button renders 400 (or 700) through
  `--btn-fontweight`. `envNumber` parses `NaN` and falls back to `--wzl-font-weight-medium`, or 500, so
  `measureButton` measures the label in the wrong weight and the HUD button's width comes out different from the DOM
  one. The same happens if `--wzl-font-weight-medium` is itself a keyword. The CSS weight keywords (`normal` → 400,
  `bold` → 700) should map to numbers, or the function should throw the way `envPx` does, instead of silently using
  some other token's value.
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

<!-- done: 4 findings, files read: 9 -->
