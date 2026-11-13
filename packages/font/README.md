# @weasel-js/font

MSDF font atlases, glyph metrics, and runtime glyph rasterization for
`@weasel-js/core`.

A `base`-tier package: core depends on it, never the reverse. It owns the
font registry — the one piece of module-level state whose duplication renders
no glyphs at all.

## What's here

| Module | Role |
| --- | --- |
| `FontAtlas` | BMFont metrics parsing |
| `registerFont` | The registry, variant resolution, texture upload |
| `dynamic/` | Runtime canvas-SDF rasterization for glyphs with no baked atlas |
| `textureSink` | The `GlyphTextureSink` seam — the renderer injects GL texture upload, so this package never imports one |
| `textSdf` | The GLSL that turns an atlas sample into glyph coverage, for the renderer's batch program to paste in |

## Faces from font files

`registerFontOutlines(family, { weight, style }, source)` registers one face from its font file: a
URL, an `ArrayBuffer`, a `Blob`, or a function returning one. TrueType, OpenType, WOFF and
collections (`.ttc`, `.dfont`) load; WOFF2 does not, and its load fails with a warning saying so.
A family with no atlas lays out and draws from these outlines, and the text edit overlay sets its
glyphs in the same bytes. `loadFontOutlines(family, variant)` resolves to `'ready'` or `'failed'`
once the bytes are parsed.

## Without a browser

`@weasel-js/font/metrics` carries the part that runs in Node or a worker:
`parseBmFont`, `faceMetricsFromTables` and the other face-metric readers, and
`cssFamilyName`. The package root also loads faces through `document.fonts`
and rasterizes through a canvas, so a server measuring text imports the
subpath instead.

## Fallback

An unregistered family renders in the default family with a one-time warning:

```ts
setFontFallbackPolicy('substitute');  // default — render in the default family
setFontFallbackPolicy('canvas');      // rasterize the real typeface at runtime
setFontFallbackPolicy('none');        // hard miss: render nothing

setDefaultFontFamily('Inter');        // defaults to the first registered family
```

Substitution changes advance widths, so measurement and wrap differ from the
requested font. `ResolveResult.substituted` reports it so a UI can
surface the swap.

## Emoji

An emoji is drawn by the platform, whatever face its run is set in: the whole
grapheme cluster (`👍🏽`, `🇨🇦`, a joined family) is rasterized once through a 2D
canvas and kept, in its own colors, on RGBA pages of the dynamic atlas beside
the distance-field ones. It paints untinted and takes only the opacity of the
text's fill. Under `setFontFallbackPolicy('none')` only a run already on the
canvas tier gets one; anywhere without a canvas or a color emoji font, a
cluster is laid out one code point at a time in the fill color.

## Generating an atlas

`npm run gen:font` (source in `scripts/gen-font.ts`).
