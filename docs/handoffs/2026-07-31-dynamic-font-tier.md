# Dynamic font tier: metrics offset, magnification wobble, text picking

**Date:** 2026-07-31
**Branch:** `text-tier-and-picking` (branched from `main` @ `292a4a4a`)
**Status:** §1 root-caused and fixed. §0 is the new direction for §2. §3 open.

Three defects surfaced after WeaselDraw started offering machine fonts through
the kit's dynamic canvas-SDF tier (`packages/font/src/dynamic/`). All three are
reproducible in `npm run dev:draw`.

## 0. Direction: tessellate glyph outlines instead of size-tiering the bake

The planned fix for §2 was a second, larger SDF bake tier. The better move is
to stop rasterizing for large text at all: parse the font with Typr /
opentype.js, pull the glyph outlines, and push them through the path pipeline
the kit already has. No new rendering library — weasel already tessellates
paths and already ships earcut. Cache the tessellation per `(font, glyph)` in
em space and transform per instance, so it is zoom-independent and computed
once.

The reason to prefer this over a runtime MSDF/SDF tier is not just glyph
quality. It collapses three open items at once:

- large text becomes exact at any zoom (§2 below),
- **stroked text falls out for free** — it is a path, so stroke it. That
  retires the TODO entry that currently scopes stroked text as a shader change.
- **gradient and pattern fills on text come free too**, since paths already
  take a `FillStyle`. That is the fill-mode-expansion TODO.

An Illustrator-style destructive "Create Outlines" command becomes a one-liner
once outlines are in hand.

Keep the atlas for small text. Outline rendering has no hinting and no stem
darkening, so body text at 12–16px looks *worse* than the platform rasterizer —
`glyphRasterizer.ts`'s header already measures exactly this and explains why
(a hinted rasterizer places stems on the pixel grid; no size-independent field
can encode that). A size threshold between the two tiers is the standard
hybrid, not a compromise.

So the shape of the work: `queryLocalFonts` → font bytes → outlines →
tessellate through the existing path renderer above a size threshold; atlas
below it; today's canvas-SDF tier stays as the fallback for denied permission
or non-Chromium.

### What is already in place, and what is not

Checked, not assumed:

- **The path model fits with nothing added.** `PolygonPath`
  (`features/paths/types.ts`) is a `Uint8Array` command stream plus a
  `Float32Array` of coords, with `PATH_M/L/C/Q/Z` and a `fillRule`. That is
  multi-contour with both quadratic (TrueType) and cubic (CFF) segments and
  `'nonzero'` — exactly a glyph outline, counters included. No new geometry
  type, and `pathFromD` already exists if the parser emits SVG `d`.
- **`queryLocalFonts` is present in this Chrome and its permission reads
  `'prompt'`** — so the bytes are reachable, but only after a user gesture
  grants access. The fallback ladder in the paragraph above is load-bearing,
  not defensive.
- **No font parser is a dependency yet.** `package.json` has `earcut` and
  `msdf-bmfont-xml` (build-time) — no `opentype.js`, no `Typr`.
- **The bundled family has no outlines to tessellate.** `assets/fonts/inter/`
  ships `inter.json` + `inter.png` and no TTF/OTF/WOFF. So the default
  `sans-serif` is exactly the family the outline tier *cannot* serve unless we
  also ship an Inter binary (or subset one). Worth deciding early, because
  "large text is exact at any zoom" reads as a global promise and would not
  hold for the default face.

`layoutRuns` currently emits `LaidOutGroup[]` of textured quads bucketed by
atlas + fill. An outline tier needs a third `source` alongside `'atlas'` and
`'canvas'` that carries a `Path` plus a per-instance transform instead of UVs —
that is the main structural decision, and it is where the design work should
start.

## 1. Text is displaced from its pose box — FIXED

**Root cause: not the font tier, and not `layoutRuns`.** The kit's default
text painter, `TEXT_PAINTER` in `packages/core/src/canvas/NodeShape.ts`,
passed `pose.y + fontSize` as the draw command's `y`. That is the canvas-2D
`fillText` convention (y = baseline), but `TextDrawCommand.y` is the **top of
the first line box**: `layoutRuns` walks *down* from it by `common.base *
scale` to reach the baseline, and `verticalAlign` aligns the laid-out block
within `[y, y + height]`.

Consequences, all of which reproduce with a single family and no dynamic tier
involved:

- the baseline landed ~1.97 em below the box top instead of ~0.97 em, so a
  one-line node at `lineHeight: 1.2` had its baseline at the box's *bottom*
  edge and its descenders outside the pose entirely;
- the box handed to `verticalAlign` was a different box from the node's own,
  one em down, so `'center'` / `'bottom'` were wrong by construction;
- it disagreed with the kit's own `createTextLayer`, which passes `pose.y`
  directly, and with the DOM editing overlay
  (`useSceneTextEdit.getScreenPose`), which anchors on `pose.y` — which is why
  text jumped a whole line the moment an edit was committed.

**Fix.** `const y = p.y;`. Tests in `NodeShape.test.ts` and
`defaultDrawOne.test.ts` that encoded the old convention were rewritten to
assert the pose-box anchor; two new tests pin it (including that the anchor no
longer moves with `fontSize`).

**Why nothing caught it.** All 30 visual baselines pass unchanged across this
fix, because *no baseline renders text through `kit:text`*. `TextDemo` uses
`createTextLayer`; `RenderToPixelsDemo` builds its text command by hand with
`textCommand(pose.x, pose.y, …)` (to reach `verticalAlign`, which the painter
does not forward). Both already used the correct anchor — the painter was the
only caller that didn't, and it was the only one with no pixel coverage. A
demo that paints a text node through the default drawer would be worth adding.

**Rig note, found while verifying this.** `tests/visual/playwright.config.ts`
wanted port 5174, which is also `dev:draw`'s port; with
`reuseExistingServer: !CI` a local run silently attached to WeaselDraw and
failed all 25 baselines against the wrong application. Visual now runs on
5177. Ports: 5173 smoke / 5174 dev:draw / 5175 e2e / 5176 perf + draw e2e /
5177 visual.

**The ~84px family-relative figure in the previous draft does not
reproduce.** Measured directly, by calling `layoutRuns` in the running app for
the same runs at the same `fontSize` (48) and the same origin:

| family | tier | `info.size` | `common.base` | first-quad baselineY |
|---|---|---|---|---|
| Inter (`sans-serif`) | atlas | 32 | 31 | 46.5 |
| Impact | canvas | 48 | 48 | 48.0 |
| Georgia | canvas | 48 | 44 | 44.0 |

Impact vs Inter is 1.5px at a 48px em — 3% of the em, exactly the size the
ascender table predicts, and it *shrinks* rather than grows relative to the
observed 84px as the font size falls. Whatever produced the earlier side-by-side
capture, it was not a per-family layout error. The real defect was the
one-em displacement above, which is family-independent — which is precisely why
the earlier instrumentation of `info.size` / `common.base` could not find a
term that accounted for it.

**Still open, and still worth doing: the two tiers read different ascender
tables.** Chrome reports Inter at 0.896 em (OS/2 `sTypoAscender`) where
`msdf-bmfont-xml` / opentype.js baked 0.969 em (`hhea.ascender`).
`emHeightAscent` / `emHeightDescent` are **undefined** in Chrome, and a DOM
baseline probe returns exactly the same number as `fontBoundingBoxAscent`
(measured), so no browser API recovers the hhea value. Measured at a 48px em:

| family | `fontBoundingBoxAscent` | DOM baseline probe | ratio to em |
|---|---|---|---|
| Inter | 43 | 43 | 0.896 |
| Impact | 48 | 48.5 | 1.01 |
| Georgia | 44 | 44 | 0.917 |
| Comic Sans MS | 53 | 53 | 1.104 |
| Papyrus | 45 (descent 29!) | 45 | 0.938 |

Decide a single convention and normalize both tiers onto it. Note Papyrus has
ascent+descent = 1.54 em, which cannot fit the default 1.2 line box under any
convention — that case needs a rule of its own. The outline direction in §0
makes this easier, not harder: reading the font bytes gives access to both
tables directly instead of to whichever one Chrome chose to expose.

## 2. Glyph contours wobble under magnification

The tier is TinySDF: `fillText` once at `BAKE_SIZE = 48`, take the antialiased
coverage, run a Euclidean distance transform (`distanceTransform.ts`,
`SDF_RADIUS = 8`, single channel). Contour accuracy is bounded by that 48px
raster — roughly ±⅓ texel after sub-pixel refinement. Displayed at ~8× the bake
size, that becomes ±2–3px of visible wobble, with bumps one bake-texel apart.
Baked MSDF (Inter) is immune: multi-channel and generated from outlines.

`glyphRasterizer.ts`'s header measured error out to 128px and called
magnification "the mild one" — its data stops well below where this shows up.

**Superseded plan: size-tiered baking.** Keep 48 for the base tier, add a
larger tier (~192) and select per draw by on-screen size. The header's argument
against raising `BAKE_SIZE` (it would spoil 12–32px UI text, where error is
minimized *at* the bake size) does not apply to tiers — small text keeps the
48px bake. Work: cache key gains a tier, atlas pages per tier, face resolution
takes a display size, layout scales by the tier's own `info.size` (which it
already reads, so this may mostly fall out).

**Do §0 instead.** A larger bake buys a bounded improvement — the wobble gets
finer, it does not go away, because the field is still reconstructed from a
raster. Outlines are exact at every zoom and pay for stroked text and non-solid
text fills on the same trip. Keep the tiered bake in mind only as a cheap
interim if the outline path stalls on something unforeseen.

## 3. Picking hits blank space inside a text box

`pointInTextPose` (`features/text/hitTest.ts`) is a pose-rect test by design.
For `"Away"` in a 309-unit-wide box most of the box is empty, and clicking any
of it selects the node.

**Planned fix.** `caretIndexAt` in the same file already re-runs the wrap and
computes `lineStarts` plus per-line widths honoring `style.align`. Factor that
into a `textLineBoxes(ctx, pose)` returning per-line rects, add a precise mode
that tests against those (plus a small padding so a hairline is still
grabbable), and route node picking through it for text nodes. This is the
text-specific half of the "geometry-accurate picking" TODO entry.

## Already fixed (on `main`, `292a4a4a`)

Empty text nodes are discarded on commit — they were invisible full-size pick
targets and the loudest part of "text picking is a mess". A document created
before that fix can still contain them; `kit-text-1` / `kit-text-2` in the dev
localStorage scene are examples, left in place rather than silently mutating
the document on load.
