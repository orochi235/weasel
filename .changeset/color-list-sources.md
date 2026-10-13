---
'@weasel-js/theme': patch
'@weasel-js/labkit': patch
---

Adds API: an item of a `ColorList` may be a `ColorSource` as well as a CSS string, so a theme's `tones`, a `<ThemeProvider tones>`, and a `Lab`'s `nebula` can name a palette entry, a theme token, a ramp step, or another tone. `colorAt` and `colorCssAt` resolve such an item against the context's palette and then its theme, and take a `ColorSourceContext`; `colorCssAt` writes an item that names the theme as its custom property. A function list may return a source. `ColorListItem` is the new item type. A theme definition's `tones` takes literals and refs, not function sources.

Both functions throw on a source item nothing answers, as they do on an empty list. A tone that names itself, directly or through another tone, resolves to nothing.
