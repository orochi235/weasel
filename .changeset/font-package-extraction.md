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
you name with `registerCanvasFont` is served under every policy, and
`isCanvasFont` reports that distinction — it answers "will the dynamic tier
serve this family right now", so an auto-enrolled family reads `false` under
`'substitute'` and `'none'`. The default
family may be a canvas-registered family, and when it cannot serve the
request either, the resulting blank text is reported with its own warning
naming the default family rather than failing silently. Requesting the
default family itself also warns — whether it is registered at a variant it
can't serve, or `setDefaultFontFamily` named a family that was never
registered at all; either way there is nothing left to fall back to. An app
that has registered no fonts and set no default stays silent, since that is
not a misconfiguration.

`ResolveResult.substituted` reports the substitution structurally, and
`ResolveResult.resolved` now
carries the matched `family` alongside `weight` and `style` — the full atlas
identity to pass to `getFont` / `textureCacheKey`.

Adds `listFonts()` for enumerating registered families.
