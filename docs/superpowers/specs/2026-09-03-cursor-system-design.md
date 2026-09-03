# `@weasel-js/cursor` — custom tool cursors

Design for a package that lets a tool show a real pencil, bucket, eyedropper or
rotate cursor instead of a CSS keyword. For whoever implements it; assumes
familiarity with `Tool.cursor` and the gesture dispatcher, not with cursor
rasterization.

The question it answers: **where do cursor images come from, and how does one
reach the screen when it is too big to be a CSS cursor at all?**

## What already exists

Cursor *routing* is done and is not changing. `useGestureDispatcher.tsx` runs a
hover pump with four sources, in precedence order:

1. `AffordanceHit.cursor` — resize corners, the rotation ring, path anchors, and
   layer claims from `CanvasExtensionApi.hitTestExtras` (which is how
   `@weasel-js/hud` widget cursors arrive).
2. `Action.cursor` — the action a drag from this point *would* route to.
3. `Tool.cursor` — the active tool's resting cursor, React-managed on the host
   element via `Canvas.tsx:resolveToolsCursor`.
4. Mid-gesture, `Action.activeCursor ?? Action.cursor` replaces all of the above.

Every one of those resolves to a **CSS cursor string**. Today every such string
in the repo is a bare keyword — there is no `cursor: url(...)` anywhere in
source. This package's job is to make the other kind of string, and to handle
the case where no string can work.

## The two tiers

A cursor is either **baked** (a CSS `url()` data URI the compositor draws) or
**painted** (drawn into the canvas with the native cursor hidden). Baked is
better whenever it is possible: the compositor updates it independently of the
frame loop, so it never lags a busy render.

**Tools never choose the tier.** A tool declares what it wants; the resolver
picks. Escalation to painted happens when any of these hold:

- resolved size exceeds **128 CSS px** (see *Measured browser behavior*),
- the glyph is sized in **world units**, so it must track zoom (a brush radius
  ring), or
- the glyph needs **live scene data** (a fill preview, the color under the
  pointer).

This is the whole reason the two tiers share a package. A brush cursor is a
brush cursor at every radius; the fact that it stops being expressible as a CSS
cursor somewhere around 128px is a mechanism detail, and a tool author should
never write code that branches on it.

What a tool declares:

```ts
type CursorSpec =
  | string                     // a CSS keyword, passed through untouched
  | {
      glyph: CursorGlyphName;
      /** Fixed CSS px. Default 24. */
      size?: number;
      /** World units instead of `size`. Forces the painted tier. */
      worldRadius?: number;
      /** Radians, quantized to 22.5° at bake. */
      angle?: number;
      /** Keyword drawn if the image is rejected. Default 'default'. */
      fallback?: string;
    };
```

`Tool.cursor`, `Action.cursor`, `Action.activeCursor` and
`AffordanceRegion.cursor` widen from `string` to `CursorSpec`. A bare string
keeps working everywhere, so no existing declaration changes.

## Glyph format

A glyph is **SVG path `d` strings tagged with a paint role**, plus a hotspot in
glyph units:

```ts
interface CursorGlyph {
  /** Side of the square viewBox the paths are authored in. */
  readonly box: number;
  /** Hotspot in glyph units. Scaled and rounded to integer CSS px at bake. */
  readonly hotspot: readonly [number, number];
  readonly paths: readonly CursorPath[];
}

type CursorPath =
  | { role: 'ink'; d: string }                    // the silhouette
  | { role: 'detail'; d: string; width: number }  // a division drawn in halo color
  | { role: 'accent'; d: string; fill: string };  // a literal color (swatch chips)
```

The halo is not a path. It is a render property of `ink`: every ink path is
stroked in the halo color *behind* its fill (`paint-order: stroke fill` in SVG,
stroke-then-fill in canvas). One glyph, two renderers, identical output.

This format is the point of the whole design. `d` strings are the one geometry
representation both renderers consume without translation — the baker
interpolates them into `<svg>`, the painter runs them through `new Path2D(d)`.
It also matches the repo's existing stance that external geometry is SVG `d`
(`docs/conventions.md`).

### Why not `currentColor` and the outlined icon register

A baked cursor is an image; no CSS cascade reaches inside it, so `currentColor`
is unavailable and the ink color must be literal.

More consequentially, the register used by both existing icon sets —
`packages/core/src/icons/*.tsx` and `packages/ui/scripts/icons/*.mjs`, both
20×20 `currentColor` `stroke-width: 1.5` **`fill: none`** — does not survive as a
cursor. An unfilled glyph over dark artwork is a dark outline around a dark
hole. Filled-with-halo is legible on white paper, dark chrome, and mid-tone
artwork alike, which is why every shipping editor draws cursors that way.

So cursors and icons **share a grammar and not a register**: same square grid,
same computed-geometry authoring, same proof-at-10× discipline, different paint.
Do not derive cursor paths from `ICON_PATHS` or from the core tool icons. A
toolbar glyph is centered in its box and optimized for 16px chrome; a cursor is
composed toward its hotspot and carries a halo that would ruin a toolbar glyph.

## Package layout

`packages/cursor`, published as `@weasel-js/cursor`. No dependency on `core` —
it is geometry, string baking and a `Path2D` painter, all framework-free, in the
shape `@weasel-js/loupe` already established (a model with no surface). `core`
depends on it; `hud` may.

```
packages/cursor/
  scripts/glyphs/*.mjs      authored geometry, computed not eyeballed
  scripts/gen-cursors.mjs   -> src/glyphs.ts (generated, resolved literals)
  src/glyphs.ts             GENERATED
  src/bake.ts               glyph + size + rotation -> CSS cursor string
  src/paint.ts              glyph -> Path2D draw onto a 2D context
  src/resolve.ts            spec -> { kind: 'baked', css } | { kind: 'painted', … }
  src/layer.ts              the painted-tier canvas layer
  src/index.ts
```

`gen:cursors` mirrors `gen:icons`: the `.mjs` sources compute their own terminus
geometry and the generator writes resolved literals, so the shipped module
carries no math.

## Painted tier

`@weasel-js/cursor` exports a canvas layer. When the resolver returns a painted
cursor, core sets `cursor: none` on the host and the layer draws the glyph at
the pointer each frame.

It is a layer rather than something each tool draws in its own `overlay` because
the alternative is every tool re-wiring the same thing — the kit-level form of
the hand-rolling defect the demo rules already forbid. Riding the existing
extension/layer system also means HUD widget cursors (`Widget.cursorAt`) get the
painted tier for free, through the layer-claim path they already use.

Per the frame-loop rule in `CLAUDE.md`, the layer draws under `useVisibleRaf` and
never a bare `requestAnimationFrame`.

## Rotation

Bake takes an angle. This delivers two things at once:

- a **rotate cursor** for `rotationHandle.ts`, which currently falls back to
  plain `'grab'`; and
- **rotation-aware resize cursors**, fixing `cornerResize.ts:90`, which picks
  its diagonal from corner parity and is explicitly not rotation-aware.

Quantize to 16 steps of 22.5°. Below that the cursor visibly snaps against a
smoothly rotating selection; above it the cache grows for no perceptible gain.

## Caching

Bake is memoized on `(glyph, size, angle)`. The hover pump runs on every idle
`pointermove`, so an unmemoized bake would build a data URI per pointer event.
The cache is a plain `Map`, bounded by the glyph set times 16 angles times the
handful of sizes in use.

Ink and halo are constants of the register, not parameters — a self-contrasting
glyph is self-contrasting precisely because it does not track the theme. They
stay out of the key.

## Measured browser behavior

Measured on Chrome 152 / macOS 26.5 / DPR 2, by screenshotting the real OS
cursor (`screencapture -C`). Recorded because none of it is derivable from the
code and all of it is expensive to rediscover.

**An SVG data-URI cursor is crisp on a retina display.** Chrome rasterizes it at
device scale. The widely repeated claim that SVG cursors are rasterized at 1× and
upscaled is false here, and the design depends on it: cursors ship as SVG only,
with no PNG pipeline and no `image-set()`.

**A 1× PNG cursor *is* visibly blurry** at DPR 2 — soft edges, and fine detail
dissolves. `image-set(url(1x) 1x, url(2x) 2x)` fixes it and works correctly for
cursors. Keep this only as the fallback if another engine turns out to rasterize
SVG at 1×; the baker owns the string, so switching is a local change.

**For a cursor image, 1 image px = 1 CSS px.** A 48×48 asset renders at 48 CSS
px. Size is controlled by the asset's declared dimensions, not by any CSS
property.

**Above ~128 CSS px Chrome silently drops the image** and falls back to the
keyword after the comma, with no error anywhere. This is the origin of the
escalation threshold. (Sizes 130–148 were dropped and 150–154 appeared to
render; the non-monotonicity is capture-timing noise, not a second cap. 128 is
also Chrome's documented constant.) **Always declare a keyword fallback** —
without one the cursor becomes `auto` when the image is rejected.

## First cursor set

`pencil`, `brush`, `pen`, `bucket`, `eyedropper`, `rotate`, and a
`crosshair+glyph` composition for the shape tools (rect, ellipse, line, star,
polygon), which are all bare `'crosshair'` today and so indistinguishable from
each other.

`brush` is the one that exercises the painted tier: its radius is a world-space
quantity, so it escalates on zoom rather than on size alone.

## Retiring the CSS stub

`apps/draw/src/app.css:327` forces `cursor: copy` through a
`[data-mode="path-edit"][data-alt-held="true"]` attribute selector, fed by a
hand-rolled Alt keydown/keyup listener in `App.tsx`. It bypasses the cursor
pipeline entirely. Replace it with an affordance- or action-declared cursor and
delete both the CSS rule and the listener; it is the validation case for whether
this package makes the real pipeline pleasant enough to use.

## Build order

Four arcs, each landing something usable.

1. **Baked tier.** Package skeleton, glyph format, `gen:cursors`, `bake.ts`,
   cache. Ships `pencil`, `pen`, `bucket`, `eyedropper` as static cursors, wired
   through the existing `Tool.cursor`. No core type changes yet — the bake
   output is a string, so it drops into today's field.
2. **`CursorSpec` and rotation.** Widen the four cursor fields, add the angle
   parameter, give `rotationHandle.ts` a real rotate cursor and
   `cornerResize.ts` rotation-aware diagonals.
3. **Painted tier.** `paint.ts`, the layer, the escalation rule, `cursor: none`
   handoff. Ships `brush` with a world-space radius.
4. **Retire the stub.** Replace the `apps/draw` `cursor: copy` CSS rule and its
   Alt listener, and add the shape-tool `crosshair+glyph` set.

## Testing

Unit tests cover what is deterministic without a browser: hotspot scaling and
rounding, the escalation rule at its boundaries, cache key identity, rotation
quantization, and that `bake` and `paint` are driven from the same glyph record.

Visual proofs are rendered headlessly with `resvg` — every glyph over white,
dark chrome, and mid-tone artwork, large for geometry and again at true cursor
size for the pixel grid, per the icon rules in `CLAUDE.md`.

Two things tests here cannot establish, so do not write ones that appear to:

- **jsdom has no cursor.** Asserting `el.style.cursor` proves a string was
  written, never that anything rendered. Say so at the assertion.
- **A headless browser draws no cursor at all.** The measurements above required
  a real window and the OS compositor. They are one-time; nothing in the ongoing
  build needs a headful browser.

## Residual risk

The browser facts are Chrome-only. Safari and Firefox may rasterize SVG cursors
at 1× or cap at a different size. Measuring them is worthwhile but does not
block this work: both the crispness fallback (`image-set`) and the cap
(a threshold constant) are contained inside `bake.ts`.
