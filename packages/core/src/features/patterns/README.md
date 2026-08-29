# patterns

Repeating texture tiles for `FillStyle`.

## How a pattern becomes a fill

`patterns.ts` builds a tile from a draw callback:

1. The tile renders to an `OffscreenCanvas` (falling back to a regular
   `<canvas>` where `OffscreenCanvas` is unavailable).
2. It's converted to an `ImageBitmap`.
3. That's registered via `registerTexture()`.

The returned `TextureHandle` is what `FillStyle.pattern` accepts — so a
patterned fill is `{ fill: 'pattern', pattern: handle }`. See
`@weasel-js/paint`.

The tile is rasterized **once**, at build time, not per frame. Consequences
worth knowing: a pattern doesn't re-render when you zoom (it's a texture, so it
resamples), and a tile built at one device-pixel-ratio doesn't automatically
rebuild for another display.

## Built-ins

`patterns-builtin.ts` ships ready-made named patterns — hatch, crosshatch,
dots, chunks — exported through the `@weasel-js/core/patterns-builtin` subpath
rather than the main barrel, so consumers that don't use them don't pay for
them.

Reach for the built-ins first; drop to the tile builder when you need a pattern
they don't cover.
