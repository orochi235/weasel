---
'@weasel-js/ui': minor
'@weasel-js/ui-logic': minor
'@weasel-js/hud': minor
---

`Button` takes `size="xs"`, a 22px button for dense chrome such as a title bar.

It stands at `--wzl-control-h-xs` with the small type, a 12px glyph and tight padding, and is square when icon-only. `measureButton` and the HUD button take it too, through the new `ButtonSize` type. Only a button takes `xs`: `ControlSize` and `ControlSizeScope` stay `sm` / `md`, since no other control has a design at that height.

<!-- entry: new api -->
