# Handoff — stroked text on the outline tier

**Date:** 2026-08-02
**Branch:** `text-stroke` (4 commits, off `main` @ `70205932`), local only
**Backlog entry:** `docs/TODO.md` § Text — "Stroked text"

---

## Status

**Implemented and green, with one unresolved visual question — read the last
section before merging.** `npm run typecheck` clean; `vitest` 647 files /
6003 tests passing.

## What landed

1. **The model.** `TextStyle.stroke?: Stroke` and `StyledRun.stroke?: Stroke`,
   resolved onto `ResolvedRun` (a run's stroke *replaces* the node's — unlike
   the decorations, there is only one outline to paint) and carried on
   `LaidOutGroup.stroke`. `strokeKey` joins `fillKey` in the group key, since
   the group is the draw call and one call paints one ribbon.

2. **The paint.** `drawTextOutlineGroup` emits a second batched draw call over
   the group's merged geometry, after the fill — Canvas2D's
   fillText-then-strokeText order, and SVG's default paint-order. Ribbons cache
   in em space per `(glyph, quantized em width, join/cap/miter/align/dash)` in
   `renderer/cache/outlineStrokeMeshCache.ts`, the sibling of the fill cache.
   The width crosses into em space by dividing by the glyph's `scale`, so
   `stroke.width` stays a world measure and does not grow with `fontSize`.

3. **Small text stays bare.** Below `OUTLINE_MIN_SCREEN_PX` a glyph is a
   sampled distance field with no geometry to stroke, so nothing is drawn
   rather than something wrong. The old SDF second-threshold trick was
   deliberately not built: it has no real joins to give, and a 1px outline on
   12px text is not a design anyone asked for.

4. **The control stops lying.** `kit:shape` already reads `data.stroke` /
   `data.strokeWidth` off the kit-native leaf shape; `kit:text` now lifts the
   same two fields onto the node's `TextStyle`, with the same `'none'` and
   zero-width handling. That is what makes one pair of stroke controls mean the
   same thing on a text node as on a rect — in *any* consumer on the kit-native
   shape, not just WeaselDraw. An explicit `style.stroke` is the richer form
   and wins outright.

5. **A general path fix, found on the way.** `extractPolylines` now drops a
   closed contour's duplicate final point (`982b8aba`). Z already says "return
   to the start", so the duplicate leaves a zero-length closing segment that
   the stroker discards along with the wrap-around join. Every font outline
   opentype.js serializes is written this way, as is much exported SVG — so
   this was a latent defect for *any* stroked path from `d`, not only text.

6. **A demo toggle** beside the outline-tier toggle in `text-outlines`.

## The unresolved part — read this before merging

Rendered in the browser, stroked glyphs show **small notches at contour
seams** (visible on `R`'s counter, `a`'s bowl, `m`'s left stem, `b`'s bowl).
I could not root-cause them, and the evidence is contradictory:

- The CPU-side ribbon is **provably complete**. A point-in-mesh probe over
  ~50k samples spanning the full half-width band around every contour vertex
  of `R`, `a` and `m` found zero uncovered points, for both round and miter
  joins, in em space and at world scale alike. Merged world-space meshes match
  the per-glyph triangle sums exactly, with no index corruption.
- The fill alone renders perfectly; only the stroke shows the notches.
- Tessellating per glyph in world space (bypassing the em-space cache entirely)
  produced a pixel-identical result, so it is not the cache or the merge.

**Caveat on all of the above:** late in the session the demo dev server proved
untrustworthy — it served my edited module over HTTP (verified with `curl`)
while the page kept executing an older copy, so a control experiment (width
2 → 8, colour change) rendered pixel-identical. Several of the browser
comparisons above may therefore have been made against stale code. The unit
tests and the node-side probes are unaffected by this and are the parts to
trust.

**Suggested next step:** re-check in a browser from a cold server (or better,
add a `tests/visual/` spec, which renders through the built demo rather than
the dev server) before deciding whether there is a real stroker defect here.
If there is, `emitJoin`'s closed-path wrap (`tessellate/stroke.ts`) is the
place to look — the notches sit at contour seams, which is exactly where the
closer segment and its wrap-around join meet.

## Not done

- **SVG export.** `apps/draw`'s `leafToObj` builds a `TextObj` with no stroke,
  so a stroked text node exports unstroked. Needs matching `stroke` /
  `stroke-width` emission (and the parse side, for round-tripping).
- **Draw's own UI** was not touched — it did not need to be, since the leaf
  fields it already writes now reach the painter.
