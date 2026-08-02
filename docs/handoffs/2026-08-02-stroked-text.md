# Handoff — stroked text on the outline tier

**Date:** 2026-08-02
**Branch:** `text-stroke` (7 commits, off `main` @ `70205932`), local only
**Backlog entry:** `docs/TODO.md` § Text — "Stroked text"

---

## Status

**Done, verified on screen.** `npm run typecheck` clean; `vitest` 647 files /
6006 tests passing. The seam artifact that held this up is root-caused and
fixed — see below.

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

## The seam artifact — found and fixed

Stroked glyphs initially rendered with pieces of their outline missing, along
long straight edges. Root cause: **the `d` reaching the renderer had no `Z`**,
so every glyph contour was stroked as an *open* polyline — no closing edge, a
cap at each loose end. The fill never noticed, because earcut closes a contour
implicitly; only a stroke follows exactly the path it is handed.

Fixed in `packages/font/src/outline/outlineRegistry.ts` (`0b94b637`):
`closeContours` normalizes every glyph's path data on the way out of
`glyphOutline`. It lives in the registry rather than in `opentypeParser`
because the same hole is open to every consumer-supplied `OutlineParser` — and
because the *same* opentype version emitted `Z` under node while omitting it in
the browser build, so a parser-level fix would not have been reliable.

Two process notes worth keeping, since they cost most of the debugging time:

- **The dev server's watcher did not pick up edits in this worktree.** It
  serves whatever was on disk when it started; a control experiment (stroke
  width 2 → 8 plus a colour change) rendered pixel-identical, and several
  earlier comparisons were consequently made against stale code. Restart the
  server after every edit, or verify freshness with an in-page marker.
- **Two of my geometry probes were wrong in ways that produced false
  "all clear" results** — one counted degenerate triangles as covering every
  query, the other had a sign error in its barycentric test. Both agreed the
  ribbon was complete while the render disagreed. The render was right. A
  probe that contradicts a screenshot deserves the same scrutiny as the code
  it is testing.

## Not done

- **SVG export.** `apps/draw`'s `leafToObj` builds a `TextObj` with no stroke,
  so a stroked text node exports unstroked. Needs matching `stroke` /
  `stroke-width` emission (and the parse side, for round-tripping).
- **Draw's own UI** was not touched — it did not need to be, since the leaf
  fields it already writes now reach the painter.
