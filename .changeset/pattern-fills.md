---
"@weasel-js/core": minor
"@weasel-js/svg": minor
---

Pattern fills tile, persist, and round-trip through SVG.

The `pattern` variant of `FillStyle` never tiled. `drawPathFillPattern`
borrowed the `imageFill` program while binding the path fill mesh VAO, which
enables `a_position` only — `a_uv` was never bound, so `v_uv` was the constant
`(0, 0)` and every fragment sampled texel (0, 0) of the tile. Textures also
uploaded with `CLAMP_TO_EDGE`, so correct UVs alone would have smeared rather
than repeated. The variant had no visual consumer, which is why it went
unnoticed.

`patternFill` is now its own program, taking `gradFill`'s vertex stage:
paint-space coordinates come from the screen position through `u_worldInv`
rather than a UV attribute, so the path mesh keeps its position-only layout.
`GLTextureCache.upload` takes a wrap argument and pattern textures bind
`REPEAT`.

Patterns pick up `units` alongside gradients. For a pattern it names the space
the tile's **origin and scale** live in — not geometry, which a pattern hasn't
got. `'bounds'` anchors the tile to the painted node's box, so dragging the
node carries the pattern and resizing reveals more tiles instead of stretching
them; `fillInPoseFrame` rebases it by translation only.

`TilePatternSpec` is the serializable payload — plain data naming a built-in
tile (`hatch`, `crosshatch`, `dots`, `chunks`) plus its parameters:

```ts
{ fill: 'pattern', pattern: { tile: 'hatch', color: '#0fb5a8', size: 8 }, units: 'bounds' }
```

`resolvePatternSpec` turns one into a `TextureHandle` at paint time, memoized
on the spec's values so identical specs share a texture. The built-in painters
resolve it alongside `fillInPoseFrame`; a consumer emitting its own draw
commands resolves it at the same place it calls that one. A `TextureHandle`
payload still works untouched, but cannot be persisted or exported — prefer
the spec.

`@weasel-js/svg` serializes a tile spec as a `<pattern patternUnits=
"userSpaceOnUse">` whose children come from the same tile description that
rasterizes the texture, so the vector and raster forms cannot drift. The spec
rides along on `data-weasel-tile` for lossless re-import; a hand-authored
`<pattern>` without it is dropped with a warning rather than guessed at.
`SerializeOptions.onWarn` is new, and reports paint that SVG cannot express —
a conic gradient, or a pattern carrying a `TextureHandle`.

`tilePreviewSvg` / `tilePreviewCssUrl` render a single tile as a standalone
`<svg>`, for pickers that need to show a tile outside a document.
