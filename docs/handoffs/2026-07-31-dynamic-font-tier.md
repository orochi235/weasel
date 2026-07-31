# Dynamic font tier: metrics offset, magnification wobble, text picking

**Date:** 2026-07-31
**Branch:** `text-tier-and-picking` (branched from `main` @ `292a4a4a`)
**Status:** investigation done, no fix committed yet

Three defects surfaced after WeaselDraw started offering machine fonts through
the kit's dynamic canvas-SDF tier (`packages/font/src/dynamic/`). All three are
reproducible in `npm run dev:draw`.

## 1. Text is displaced from its pose box (worst; fix first)

**Repro.** Create a text node with the text tool, type `Hxg`, commit. Screenshot.
Re-enter, switch the family to Impact via the character bar, commit. Screenshot.
Pose is byte-identical across the two (`{x: 76.23, y: 613.13, w: 514.37, h: 82.30}`)
— only `runs[0].fontFamily` changes.

**Observed.** Impact's baseline lands **~84 screen px below** Inter's, in the
same box at the same `fontSize`. Captured side by side; the displacement is
obvious, not subtle.

**What is ruled out.** A disagreement over which ascender table to read *cannot*
account for 84px. Measured at a 48px em:

| family | `fontBoundingBoxAscent` | DOM baseline probe | ratio to em |
|---|---|---|---|
| Inter | 43 | 43 | 0.896 |
| Impact | 48 | 48.5 | 1.01 |
| Georgia | 44 | 44 | 0.917 |
| Comic Sans MS | 53 | 53 | 1.104 |
| Papyrus | 45 (descent 29!) | 45 | 0.938 |

Worth about 0.1 em ≈ 5px at this size — an order of magnitude short of what
is observed. Something in the layout arithmetic is wrong for dynamic faces,
not just the metric source.

**Where to look.** `layoutRuns.ts:485` — `baselineY = penY + e.font.common.base * scale`,
where `scale` derives from `fontSize / font.info.size`. The two tiers feed it
very different numbers:

- baked Inter (`assets/fonts/inter/inter.json`): `info.size 32`, `common.base 31`,
  `common.lineHeight 39` → base/size **0.969**
- dynamic face (`dynamicAtlas.ts:185-190`): `info.size = BAKE_SIZE = 48`,
  `base = round(fontBoundingBoxAscent)`, `lineHeight = round(ascent + descent)`

Instrument both terms (`font.info.size`, `common.base`, the derived `scale`,
`penY`) for a baked vs dynamic face at the same `fontSize` and find which one
diverges by the missing factor. Suspect the `scale` derivation or a line-advance
term double-counting `lineHeight`, since a pure base difference is bounded by
the table above.

**Secondary, real, and separate.** Even once the big error is found, the two
tiers read *different ascender tables* for the same font — Chrome reports
Inter at 0.896 em (OS/2 sTypoAscender) where `msdf-bmfont-xml`/opentype.js
baked 0.969 em (hhea.ascender). `emHeightAscent`/`emHeightDescent` are
**undefined** in Chrome, and a DOM baseline probe returns exactly the same
number as `fontBoundingBoxAscent` (measured, see table), so no browser API
recovers the hhea value. Decide a single convention and normalize both tiers
onto it. Note Papyrus has ascent+descent = 1.54 em, which cannot fit the
default 1.2 line box under any convention — that case needs a rule of its own.

## 2. Glyph contours wobble under magnification

The tier is TinySDF: `fillText` once at `BAKE_SIZE = 48`, take the antialiased
coverage, run a Euclidean distance transform (`distanceTransform.ts`,
`SDF_RADIUS = 8`, single channel). Contour accuracy is bounded by that 48px
raster — roughly ±⅓ texel after sub-pixel refinement. Displayed at ~8× the bake
size, that becomes ±2–3px of visible wobble, with bumps one bake-texel apart.
Baked MSDF (Inter) is immune: multi-channel and generated from outlines.

`glyphRasterizer.ts`'s header measured error out to 128px and called
magnification "the mild one" — its data stops well below where this shows up.

**Planned fix: size-tiered baking.** Keep 48 for the base tier, add a larger
tier (~192) and select per draw by on-screen size. The header's argument against
raising `BAKE_SIZE` (it would spoil 12–32px UI text, where error is minimized
*at* the bake size) does not apply to tiers — small text keeps the 48px bake.
Work: cache key gains a tier, atlas pages per tier, face resolution takes a
display size, layout scales by the tier's own `info.size` (which it already
reads, so this may mostly fall out).

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
