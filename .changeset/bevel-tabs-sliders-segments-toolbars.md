---
'@weasel-js/ui': patch
'@weasel-js/theme': patch
---

A theme's bevel hooks reach the rest of the controls. `--wzl-bevel-sunken` is the shadow of a slider's track, a native range's track, a segmented control's track, and each cell of a `flat` one. `--wzl-bevel-raised` is the shadow of a slider's thumb, the chosen segment of a segmented control, and the strip a `ToolPalette`, an `ActionBar`, a `ToolOptionsBar`, or a framed `Bar` draws; a tab takes it on every edge but the one its panel is on. `--wzl-bevel-pressed` is the shadow of a `ToolButton` or a bar's action button that stays down. A `minimal` segmented control draws none. With no hook set nothing changes, so only `win9xTheme` and `platinumTheme` draw differently. Which bevel each control takes was a judgment made from computed values and one headless screenshot of each theme. The hooks' descriptions in `@weasel-js/theme` now list every control that reads them.
