---
'@weasel-js/theme': patch
'@weasel-js/ui': patch
---

`colorSourceCss` writes a palette entry or a function source that only names a theme color as that color's custom property, so it follows a mode change through the cascade with no `<ThemeProvider>`. It used to write the literal the name resolved to. This changes the string returned for such a source, from a hex color to `var(--wzl-…)`. A function that reads a color through `resolve` to compute its own is still written as the literal it resolves to.

Additive: a `CurveLayer`'s render context carries `colorCss`, which writes a `ColorSource` as CSS under the theme, tones, and palette in force. A custom layer no longer needs a component of its own to call `useColorCss`.
