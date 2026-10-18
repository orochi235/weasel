---
'@weasel-js/hud': patch
'@weasel-js/theme': patch
---

The WebGL context menu reads its shadow as the DOM panel does, `var(--wzl-bevel-raised, 0 8px 24px var(--wzl-shadow))`, so a theme's bevel reaches it: outer layers draw beneath the panel, `inset` layers over its face inside the border. Inset layers draw hard-edged whatever their blur. `boxShadowCommands` in hud draws any `box-shadow` list around a rounded box.

theme adds `expandVars`, which substitutes the `var()` references a resolved theme's values can still hold, fallbacks included, and `parseBoxShadow`, which reads a `box-shadow` value into its layers.
