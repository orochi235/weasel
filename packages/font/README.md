# @weasel-js/font

MSDF font atlases, glyph metrics, and runtime glyph rasterization for
`@weasel-js/core`.

A Tier A leaf: core depends on this package, never the reverse. It owns the
font registry — the one piece of module-level state whose duplication renders
no glyphs at all.

## What's here

| Module | Role |
| --- | --- |
| `FontAtlas` | BMFont metrics parsing |
| `registerFont` | The registry, variant resolution, texture upload |
| `dynamic/` | Runtime canvas-SDF rasterization for glyphs with no baked atlas |
| `textureSink` | The `GlyphTextureSink` seam — the renderer injects GL texture upload, so this package never imports one |
| `textSdf` | Shader source for the SDF text program |

## Fallback

An unregistered family renders in the default family with a one-time warning:

```ts
setFontFallbackPolicy('substitute');  // default — render in the default family
setFontFallbackPolicy('canvas');      // rasterize the real typeface at runtime
setFontFallbackPolicy('none');        // hard miss: render nothing (pre-0.7 behavior)

setDefaultFontFamily('Inter');        // defaults to the first registered family
```

Substitution changes advance widths, so measurement and wrap differ from the
requested font. `ResolveResult.substituted` reports it structurally so a UI can
surface the swap rather than leaving it to the console.

## Generating an atlas

`npm run gen:font` (source in `scripts/gen-font.ts`).
