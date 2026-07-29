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
typeface at runtime when the browser has it. A family the `'canvas'` policy
enrolled for itself stops being canvas-served once the policy changes; one
you name with `registerCanvasFont` is served under every policy. The default
family may be a canvas-registered family, and when it cannot serve the
request either, the resulting blank text is reported with its own warning
naming the default family rather than failing silently.

`ResolveResult.substituted` reports the substitution structurally, and
`ResolveResult.resolved` now
carries the matched `family` alongside `weight` and `style` — the full atlas
identity to pass to `getFont` / `textureCacheKey`.

Adds `listFonts()` for enumerating registered families.
