---
'@weasel-js/theme': patch
---

A theme name or axis value holding U+0000 now applies. `applyTheme`, `ThemeProvider`, and the selectors theme writes all hold it with U+FFFD in place of the NUL, as CSS itself reads one, so the attribute and its rule match; the theme used to do nothing.
