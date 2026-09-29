---
"@weasel-js/core": patch
"@weasel-js/labkit": patch
---

A labkit annotation capture of a text mark no longer comes out without its
glyphs when the default font was registered `{ lazy: true }` and nothing had
drawn text yet: the raster route now waits for fonts and paint kinds to load
before it renders.

Additive: core exports `warmRender(opts?)`, which runs `warmFonts` and
`warmPaintKinds` together — the one call to await before a synchronous
`renderSceneToPixels`, `RasterSession.render` or `renderDebugSnapshot`.
`opts.families` and `opts.paintKinds` narrow each half.
