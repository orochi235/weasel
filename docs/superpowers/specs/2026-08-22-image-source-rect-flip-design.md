# Image source rect and flip — design

**Date:** 2026-08-22
**Status:** designed

What this is: a sub-rectangle and a mirror on `ImageDrawCommand`, so one
decoded bitmap can be drawn as many frames. For anyone touching the image path
in `renderer/draw.ts`, the `@weasel-js/hud` image widget, or building a sprite
animation on top of either. It answers what the fields mean, what the renderer
does *not* validate, and why an atlas can still bleed at frame borders.

## The problem

`ImageDrawCommand` draws a whole `ImageBitmap` stretched into a destination
rect. `drawImage` hardcodes the quad's UVs to `[0..1]`:

```ts
v[0]  = x0; v[1]  = y0; v[2]  = 0; v[3]  = 0;
v[4]  = x1; v[5]  = y0; v[6]  = 1; v[7]  = 0;
v[8]  = x0; v[9]  = y1; v[10] = 0; v[11] = 1;
v[12] = x1; v[13] = y1; v[14] = 1; v[15] = 1;
```

So a sprite sheet — the ordinary way 2D art ships — cannot be drawn at all
without a custom `ShaderDrawCommand`, which means a consumer writing GLSL and
managing a program handle to do what is arithmetic on four floats. Mirroring
has the same shape: a walk cycle drawn facing left is the same frames with `u`
reversed, and today it needs either a second set of authored art or a shader.

## Surface

`packages/core/src/renderer/DrawCommand.ts`:

```ts
export interface ImageDrawCommand {
  kind: 'image';
  image: ImageBitmap;
  x: number; y: number; w: number; h: number;
  opacity?: number;
  sampling?: 'linear' | 'nearest';

  /** Sub-rectangle of `image` to draw, in bitmap pixels from the top-left.
   *  Omitted draws the whole bitmap. Not range-checked — see "What the
   *  renderer does not do". */
  source?: { x: number; y: number; w: number; h: number };

  /** Mirror the sampled region within the destination rect. */
  flipX?: boolean;
  flipY?: boolean;
}
```

`source` is in bitmap pixels rather than normalized UV because sprite sheets
are authored, sliced and described in pixels; the renderer divides by
`image.width`/`image.height`, which it has to hand anyway.

Flip is a pair of booleans, not a negative `source.w`/`source.h` and not a
negative destination `w`/`h`. Two spellings for one operation is a bug farm,
and a negative extent through code that assumes a positive one produces a
degenerate quad rather than a mirror.

## Renderer

`drawImage` derives four UV scalars and writes them into the same 16-float
quad:

```ts
const tw = cmd.image.width, th = cmd.image.height;
const s = cmd.source;
let u0 = s ? s.x / tw : 0, u1 = s ? (s.x + s.w) / tw : 1;
let v0 = s ? s.y / th : 0, v1 = s ? (s.y + s.h) / th : 1;
if (cmd.flipX) [u0, u1] = [u1, u0];
if (cmd.flipY) [v0, v1] = [v1, v0];
```

Nothing else changes. No new uniform, no shader edit, no extra GL state, so the
quad ring, the per-draw filter set and `applyClipTest` all behave as before.
The cost of the feature is four divisions on a command that already does a
texture bind.

**Flip mirrors within the destination rect.** It changes which texels land
where, never where the quad is. A flipped draw covers exactly the pixels the
unflipped one did.

## What the renderer does not do

**No validation, no clamping.** A `source` extending past the bitmap yields UVs
outside `[0..1]`. `GLImageCache` binds with `CLAMP_TO_EDGE` for the
no-repeat case, so the out-of-range part samples the edge texel — a smear, not
an error and not a wrap. This is consistent with the rest of the command, which
does not check its destination rect either.

**No automatic inset for filter bleed.** With `sampling: 'linear'` the
bilinear filter reaches half a texel outside `source`, so a frame packed
against its neighbor in an atlas picks up that neighbor along the shared edge.
The renderer could shrink the UV rect by half a texel per side whenever
`source` is set and sampling is linear, and it deliberately does not: the
sampled region would then stop matching the numbers the consumer passed, and an
exact 1:1 blit — the loupe, a framebuffer readback — would go soft. The fix
belongs to the sheet: pad frames with a gutter (`spacing` below), or use
`sampling: 'nearest'`, which is what pixel art wants regardless.

## Sprite sheet helper

`packages/core/src/renderer/spriteSheet.ts`, exported from the renderer barrel
and the main barrel:

```ts
export interface SpriteSheet {
  frameWidth: number;
  frameHeight: number;
  columns: number;
  /** Empty pixels around the whole grid. Default 0. */
  margin?: number;
  /** Empty pixels between adjacent cells — the gutter that keeps linear
   *  sampling off the neighboring frame. Default 0. */
  spacing?: number;
}

/** Row-major source rect for frame `index`, counting from 0 at the top-left. */
export function frameRect(sheet: SpriteSheet, index: number): {
  x: number; y: number; w: number; h: number;
};
```

`margin` and `spacing` follow the Tiled/Aseprite tileset convention, so a sheet
exported from either describes itself with these three or five numbers.

`index` is not range-checked and does not wrap: past the last frame it returns
a rect below the sheet, which draws as a `CLAMP_TO_EDGE` smear by the rule
above. Wrapping is the animation's business (`frameRect(sheet, tick % count)`),
not the layout's — a sheet does not know how many of its cells are filled.

## HUD widget

`packages/hud/src/widgets/image.ts` — `ImageOptions` gains `source`, `flipX`,
`flipY`, and `ImageWidget` gains matching mutators:

```ts
setSource(source: { x: number; y: number; w: number; h: number } | undefined): void;
setFlip(flip: { x?: boolean; y?: boolean }): void;
```

`setFlip` merges: an omitted axis keeps its current value, so
`setFlip({ x: true })` on a `flipY` widget leaves the vertical mirror alone.

The mutators are the point. `source` and `flip` are what a sprite animation
changes every frame, and without setters each frame means disposing the widget
and building another — churning the HUD's widget list to change four numbers.
They join `setImage`/`setBounds`/`setHidden` in calling `opts.onChange?.()`;
`opacity` and `sampling` stay read-only options, since neither animates.

## Testing

`renderer/draw.test.ts` has a mock-GL recorder, so the UV payload is asserted
directly off the `bufferSubData` call: default `[0..1]`, a source rect, `flipX`,
`flipY`, both together, source combined with flip, and a source past the bitmap
edge passing through unclamped.

**The trap:** `IMAGE_QUAD_VERTICES` is one module-level `Float32Array` reused by
every image draw, so a recorder that keeps `args[2]` keeps a reference that
reads as the *last* draw's contents. Tests copy per call
(`Float32Array.from(...)`) or assert a single draw.

`spriteSheet.test.ts` covers the grid arithmetic: frame 0, a mid-row frame, the
first frame of the second row, and margin/spacing offsets.
`hud/src/widgets/image.test.ts` covers passthrough of the three fields and each
mutator's effect on the emitted command plus its `onChange` call.

## Not in scope

**The scene-level image node.** `data.image` and the `kit:image` painter keep
drawing whole bitmaps. Giving a scene node a source rect is a real feature, but
SVG has no source rect on `<image>` — the round-trip through `@weasel-js/svg`
would need a `clipPath` wrapping an oversized scaled image, and `depSchema`,
`insert` and the image tool all widen with it. That is its own pass.

**Tiling.** Unchanged: use a pattern fill on a path.
