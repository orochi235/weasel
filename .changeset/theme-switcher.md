---
"@weasel-js/ui": patch
"@weasel-js/labkit": patch
---

`ThemeSwitcher` is one icon button that steps through an ordered list of options — by default the color modes Auto,
Light and Dark — showing the current one's glyph. A click moves to the next option and a shift-click to the previous,
both wrapping; the accessible name and tooltip read `Theme: Auto — click for Light`. It is controlled, like
`ColorModeControl`, and `COLOR_MODE_OPTIONS` is the default list. labkit re-exports both.

The lab header's color mode is now a `ThemeSwitcher` in place of the three-segment `ColorModeControl`, sized like the
header's other icon buttons.
