---
'@weasel-js/theme': patch
---

A theme name or axis value holding U+0000 applies, with U+FFFD in place of the NUL as CSS reads it.

That holds in `applyTheme`, `ThemeProvider` and the selectors theme writes.

<!-- entry: rank=-5 fix -->
