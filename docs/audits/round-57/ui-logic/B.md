# Audit round 57 — ui-logic

Reviewed at HEAD a22801b42b (the brief's c068d53f is not an object in this repo; `packages/ui-logic` has no uncommitted changes).

## measureMenuPanel measures every label at weight 400, but the DOM menu sets a current row bold
- where: packages/ui-logic/src/menuPanel.ts:53 (menuPanelMetrics), :111 (measureMenuPanel); MenuRowFace :60
- scenario: a menu whose widest row is a `current` entry (`MenuRow.tsx:64` adds `.current`, `Menu.module.css` `.current { font-weight: var(--wzl-font-weight-bold) }`). The DOM panel grows to fit the bold label. `measureMenuPanel` has no way to say a row is current (MenuRowFace carries only `label` and `trailing`), so it measures the label at weight 400 and returns a narrower panel. The HUD menu, which sizes from this measure (`hud/src/menu/panelCommands.ts` `menuFace` drops `current`), comes out narrower than the DOM menu for the same entries. The shared measure should know the row's weight.
- evidence: read
- severity: low

## measureButton shrinks the label to zero width, but the DOM label stops at its min-content width and wraps
- where: packages/ui-logic/src/button.ts:112-114 (measureButton)
- scenario: give a button with a label like "Save all" a `maxWidth` below its content width. measureButton takes the whole overflow out of the label, down to 0, and keeps it one cap-height line. In the DOM, `.label` is an `inline-block` flex item with the default `min-width: auto` and no `white-space: nowrap` (`Button.module.css` has neither). It won't shrink below its longest word, and it breaks at spaces onto a second line inside the fixed-height, `overflow: hidden` button. So the HUD button (measured with `exactly(bounds)`) and the DOM button lay out different parts in the same box. The doc comment ("the label gives up width first, down to none") describes neither the DOM behavior nor any clipping rule the DOM applies.
- evidence: read
- severity: low

## nestHold inherits a reason from an outer hold that is not on
- where: packages/ui-logic/src/hold.ts:22 (nestHold)
- scenario: `nestHold({ on: false, reason: 'Locked' }, true)` returns `{ on: true, reason: 'Locked' }`. The doc says "A level's `reason` counts only while that level is `on`", but `reason || outer.reason` reads `outer.reason` without checking `outer.on`. `Hold` is a public interface, and a consumer can build one from props (`{ on: isLocked, reason: 'Locked' }`) and pass it as the outer. The control then shows the tooltip "Locked" for a hold the lock never applied. It should be `reason || (outer.on ? outer.reason : undefined)`.
- evidence: read
- severity: low

## controlAccess and nestHold disagree about an empty reason
- where: packages/ui-logic/src/hold.ts:41 (controlAccess) vs :22 (nestHold)
- scenario: nestHold treats `reason: ''` as no reason (`reason || outer.reason`). controlAccess counts any non-undefined reason: given a `{ on: true, reason: '' }` Hold built directly, it returns `reachable: true, reason: ''`. The disabled control stays in the tab order and offers an empty tooltip, where the same hold routed through nestHold would leave it unreachable. One rule should decide whether `''` is a reason.
- evidence: read
- severity: low

## envNumber reads a percentage or a keyword as a bare number
- where: packages/ui-logic/src/measure.ts:72-75 (envNumber)
- scenario: a theme sets `--wzl-leading-snug: 120%`, which is valid CSS for line-height. `Number.parseFloat('120%')` is 120, so `rowListMetrics` and `menuPanelMetrics` compute `lineHeight = size * 120` and place labels far outside their rows. They should either convert the percentage (1.2) or fall back. Likewise `--wzl-button-font-weight: bold` reads NaN and falls back to 500/medium, where CSS draws 700. envPx rejects unknown units and throws, while envNumber silently accepts any leading digits.
- evidence: read
- severity: low

## measureRowList measures the empty state upright, but the DOM sets it italic
- where: packages/ui-logic/src/rowList.ts:104 (measureRowList)
- scenario: a list with no rows. `ItemList.module.css` `.empty` sets `font-style: italic`, but the measure calls `env.text(face.empty ?? '—', m.font)` with a FontSpec that has no style field (and `createDomMeasureEnv` builds an upright canvas font). The measured empty-state width differs from the drawn italic text's width, so a list sized to its content by the measure doesn't match the DOM list.
- evidence: read
- severity: low

## runs() passes a fractional or huge WEASEL_PBT_RUNS straight to fast-check
- where: packages/ui-logic/src/pbt.fixture.ts:6-7 (runs)
- scenario: `WEASEL_PBT_RUNS=2.5` gives `numRuns: 2.5`, and `WEASEL_PBT_RUNS=1e9` is accepted as well. `deep > 0` is the only check, so a non-integer count reaches fast-check and `timeoutFor` scales from it. It should be `Number.isInteger(deep) && deep > 0`, or floor the value. This only affects tests.
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

<!-- done: 7 findings, files read: 9 -->
