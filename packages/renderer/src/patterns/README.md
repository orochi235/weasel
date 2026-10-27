# patterns

Repeating texture tiles for `Paint`.

## How a pattern becomes a fill

`patterns.ts` builds a tile from a draw callback:

1. The tile renders to an `OffscreenCanvas` (falling back to a regular
   `<canvas>` where `OffscreenCanvas` is unavailable).
2. It's converted to an `ImageBitmap`.
3. That's registered via `registerTexture()`.

The returned `TextureHandle` is what a `texture` paint holds, so a fill of
your own tile is `{ kind: 'texture', texture: handle }`. See
`@weasel-js/paint`.

The tile is rasterized **once**, at build time, not per frame. Consequences
worth knowing: a pattern doesn't re-render when you zoom (it's a texture, so it
resamples), and a tile built at one device-pixel-ratio doesn't automatically
rebuild for another display.

## Built-ins

`patterns-builtin.ts` ships ready-made named patterns — hatch, crosshatch,
dots, chunks — exported through the `@weasel-js/renderer/patterns-builtin` subpath
rather than the main barrel, so consumers that don't use them don't pay for
them.

Each built-in is also a paint kind of its own: `{ kind: 'hatch', color }` is a
fill as it stands, serializes, and needs no handle. Reach for those first; drop
to the tile builder when you need a pattern they don't cover.

## Images

`{ kind: 'image', src, width, height }` tiles a picture. `resolveImage.ts`
hands it a texture id built from `src` at once, and the texture behind that id
is whatever `images/imageCache` has decoded for `src` when a frame draws it:
nothing while it loads, then the bitmap, then a fresh one if the cache drops
and reloads it. `width` and `height` are the tile's extent in paint units;
left out, the picture's natural size is used — for an SVG, the size it first
rasterized at, not whatever raster an image node of the same `src` has since
asked for.
