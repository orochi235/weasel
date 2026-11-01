---
'@weasel-js/headless': patch
'@weasel-js/hud': patch
'@weasel-js/ui': patch
---

A measure/draw contract a control implements on every target it is drawn on: `HeadlessComponent`, whose `measure`
is shared code reading the target's tokens and text metrics through a `MeasureEnv`, and whose `draw` is the
target's own. `@weasel-js/headless` adds `measureButton` and `measureRowList` with the parts and roles they lay out
(`buttonParts`, `listMode`, `LIST_ROLES`), and `pressStep` for a press's hover and hold. ui's `Button` and
`ItemList` implement it as `domButton` and `domItemList` (measure with `domMeasureEnv(el)`); the HUD's button and a
new `list` widget (`hud.list`, ui's `ItemList`'s keyboard and listbox semantics) implement it as `hudButton` and
`hudList` (`hudMeasureEnv`).

The HUD button now lays its label out the way the DOM button does: centered, at the theme's `--wzl-font-size`
rather than 13px when `fontSize` is not given, on a body rounded by `--wzl-button-radius` or a tenth of its height.
It takes a `size` option. A HUD accessibility node can say `selected` and `multiselectable`.
