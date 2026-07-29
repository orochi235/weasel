# @weasel-js/font

## 0.7.0

### Minor Changes

- d3e5597: Extract the MSDF glyph tier into a new `@weasel-js/font` package: font
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

- a925117: Text antialiasing is derived from the screen-space derivative instead of a
  constant.

  Both SDF text shaders computed their smoothstep band from a fixed `u_aaWidth`
  (0.05, set once per draw). A constant band cannot be correct at more than one
  scale: at 16px it collapsed to well under a screen pixel, so glyph coverage
  quantized to all-or-nothing and edges rendered as hard stair-steps; at display
  sizes the same constant read mushy. `TEXT_FRAG_SRC` and `TEXT_FRAG_R8_SRC` now
  take the band from `fwidth(sdfVal)`, which folds in font size, zoom, and DPR
  together, with a small floor so a degenerate derivative can't reproduce the
  aliased behavior.

  This changes how all GL-rendered text looks — most visibly at UI sizes, where
  it is the difference between binary and antialiased edges.

  Breaking, for anyone driving the shaders directly:

  - `u_aaWidth` is gone from both fragment sources and from `TEXT_SDF_UNIFORMS`.
    There is no CPU-side AA knob to set; the shader derives it. Setting the
    uniform was never useful — the kit only ever wrote 0.05 to it.

- eeae450: A codepoint the atlas never baked now falls back to a real glyph instead of a
  literal `?`.

  Font fallback resolved at family granularity: `resolveFontVariant` picks one
  tier for a whole run. But a baked MSDF atlas covers a fixed charset, so a run
  served by a perfectly good atlas can still contain a character that atlas has
  no glyph for — an em dash, a curly quote, anything outside the subset. Those
  drew codepoint 63. That fabricates a character the author never wrote and is
  indistinguishable from one they did; the committed text baseline read "Themed
  editing ? magenta caret" for a full commit without anyone noticing.

  `layoutRuns` now escalates the individual codepoint to the dynamic canvas
  tier, which rasterizes from installed fonts and can usually serve it for real.
  The escalated glyph gets its own draw group (different texture and shader) and
  is scaled by its own atlas's bake size. When escalation isn't available the
  character is skipped with a warning naming it, rather than substituted —
  `.notdef` is what a text stack should draw here, and the BmFont format has no
  such glyph.

  New in `@weasel-js/font`:

  - `resolveGlyphFallback(family, weight, style)` returns a canvas-tier
    `ResolveResult` for per-codepoint escalation, or `null` when it isn't
    available. Declines under the `'none'` fallback policy, which documents a
    miss as a hard miss, and when there is no canvas to rasterize into (SSR)
    rather than throwing into the layout pass.
