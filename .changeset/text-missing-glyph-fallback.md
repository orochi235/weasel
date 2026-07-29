---
"@weasel-js/font": minor
"@weasel-js/core": minor
---

A codepoint the atlas never baked now falls back to a real glyph instead of a
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
