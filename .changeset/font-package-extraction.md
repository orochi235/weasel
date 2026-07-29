---
"@weasel-js/core": minor
"@weasel-js/font": minor
"@weasel-js/hud": minor
---

Extract the MSDF glyph tier into a new `@weasel-js/font` package: font
registry, atlas parsing, glyph layout, runtime rasterization, and the SDF
text shader source. `@weasel-js/core` depends on it; `registerFont` is still
re-exported from `@weasel-js/core/renderer`, so existing call sites keep
working.

Unregistered font families now render in the default family with a one-time
warning instead of rendering nothing. Configure with
`setFontFallbackPolicy('substitute' | 'canvas' | 'none')` — `'none'`
restores the previous hard-miss behavior, and `'canvas'` rasterizes the real
typeface at runtime when the browser has it. `ResolveResult.substituted`
reports the substitution structurally.

Adds `listFonts()` for enumerating registered families.
