# Pattern fills: make them tile, make them persist, make them pickable

Design for the texture half of "fill-mode expansion" (`docs/TODO.md`,
Rendering & paint). Gradients shipped 2026-08-12; this is the same arc for
the `pattern` variant of `FillStyle`. Audience: anyone working on the
renderer's paint path, `@weasel-js/svg`, or WeaselDraw's Properties panel.

## The problem this starts from

`FillStyle` has had a `pattern` variant since the WebGL backend landed, and
it has never tiled. `drawPathFillPattern` binds the path's fill mesh VAO and
switches to the `imageFill` program, but `GLMeshCache` enables only
`a_position` (`GLMeshCache.ts:156`) — `a_uv` is never bound, so `v_uv` is the
constant `(0, 0)` for every fragment and the whole path fills with texel
(0, 0) of the tile. `GLTextureCache` compounds it by setting
`CLAMP_TO_EDGE` on every texture, so correct UVs alone would smear rather
than repeat.

Nothing caught this because the variant has no visual consumer: no demo, no
app usage, and unit tests that assert dispatch rather than appearance.
Gradients survive the same position-only VAO because `gradFill` derives its
coordinates from position in the shader instead of from an attribute.

Two further gaps sit on top. A pattern's payload is a `TextureHandle` —
`{ id: 'tex_3' }`, a counter-scoped registry key minted at runtime — so a
patterned fill cannot survive the localStorage reload WeaselDraw does, nor
cross-document paste, nor SVG export. And `@weasel-js/svg` has no
`<pattern>` path at all.

## 1. Renderer: a `patternFill` program

A pattern needs paint-space coordinates per fragment, which is exactly what
`gradFill` already computes. `patternFill.ts` takes that vertex stage
verbatim — `a_position` in, `u_worldInv` mapping screen position back to
paint space — and its fragment stage divides by `u_tileSize` before
sampling:

```glsl
vec2 uv = v_world / u_tileSize;
vec4 texel = texture(u_sampler, uv);
```

`drawPathFillPattern` switches to this program and reuses
`gradientSpaceInverse`, which already resolves `local` / `world` / `screen`.
The path mesh keeps its position-only layout; `GLMeshCache` is untouched.

`GLTextureCache.upload` grows a wrap argument. Pattern textures bind
`REPEAT`; images keep `CLAMP_TO_EDGE`. Since the cache dedups by texture id
and the two callers disagree about wrap, the wrap mode is part of what
`upload` sets on first upload for that id — a texture registered for pattern
use is never also used as an image fill, so no id needs both.

The stale claim in `imageFill.ts` that "pattern fills reuse this shader;
wrapping is baked into the texture state" goes away with the code it
describes.

## 2. Kit: `units` on patterns, and a serializable spec

```ts
| { fill: 'pattern'; pattern: TextureHandle | TilePatternSpec;
    units?: GradientUnits; opacity?: number }
```

For a gradient, `units` says what space the geometry (`from`/`to`, `center`)
is expressed in. A pattern has no such geometry, so for a pattern `units`
says what space the tile's **origin and scale** live in:

- `'bounds'` — origin at the node's box top-left, tile sized in scene units.
  Dragging the node carries the pattern; resizing reveals more tiles instead
  of stretching them. The default the picker writes.
- `'world'` — origin at the scene origin. The shape becomes a window onto a
  fixed field of pattern, which is Illustrator's default and what the broken
  code was reaching for.
- `'local'` — the enclosing group's frame.
- `'screen'` — CSS pixels, so the tile neither pans nor zooms. For viewport
  furniture.

`fillInPoseFrame` gains a pattern branch beside the gradient one: a
`'bounds'` pattern is rebased to `'local'` by translating the tile origin to
the box's top-left. Unlike the gradient branch it applies no scale — that is
the whole point of the choice above.

`TilePatternSpec` is plain data:

```ts
interface TilePatternSpec {
  tile: 'hatch' | 'crosshatch' | 'dots' | 'chunks';
  color: string;
  bg?: string;
  size?: number;
  lineWidth?: number; radius?: number;      // per-tile params
  density?: number; chunkSize?: number; seed?: number;
}
```

`resolvePatternSpec(spec): TextureHandle | null` memoizes on the serialized
spec, so identical specs across nodes share one texture and a re-render
doesn't re-rasterize. It resolves at paint time, in the node painter, next to
where `fillInPoseFrame` already runs. A `TextureHandle` payload still works
untouched — consumers building their own tiles keep the surface they have.

"Bigger hatching" is a larger `size`, which rebuilds the tile at higher
resolution rather than magnifying a small texture. This is why the spec needs
no separate scale field.

## 3. SVG round-trip

`packages/svg/src/patterns.ts` mirrors `gradients.ts`. Serialization emits

```xml
<pattern id="p0" patternUnits="userSpaceOnUse" width="6" height="6">
  <!-- the tile's vector geometry -->
</pattern>
```

Each built-in knows its own SVG body — all four are a handful of lines or
circles, the same shapes their canvas `draw` callbacks stroke. Parsing
collects `<pattern>` from `<defs>` and matches the body back to a spec,
warning and falling back for anything it doesn't recognize (a hand-authored
pattern from Illustrator, say).

A `TextureHandle` payload has no vector form and exports as nothing, with a
warning — the same treatment conic gradients already get.

## 4. App: the picker

A fifth `FILL_KINDS` entry in `PropertyFillInput`, branching to a
`PatternPicker`: a grid of the four built-ins rendered as live previews at
the current color, plus a size control. It commits through the same `setFill`
action as the gradient branch, so a pattern edit is one undo entry.

The color a pattern starts from is the current paint's color, the way
`seedGradient` already seeds from `solidColor`. Switching back to solid
collapses to the pattern's `color`, mirroring `firstStopColor`.

## Testing

`apps/site/demos/PatternPlaygroundDemo.tsx` — four rects, one per built-in —
is the fixture, and `tests/visual/patterns.spec.ts` is the regression gate.
The demo currently captures the bug exactly: two flat rects, one invisible,
one showing the backdrop.

Unit coverage: `resolvePatternSpec` memoization and identity, the pattern
branch of `fillInPoseFrame`, and SVG round-trip per built-in.
