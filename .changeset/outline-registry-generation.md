---
'@weasel-js/font': patch
---

Registering and unregistering outline faces advances the glyph generation

`layoutRuns` records which tier each run resolved to, and `cachedLayoutRuns`
holds that result until `glyphGeneration()` moves. The outline registry only
advanced the counter when a face finished *loading*, so changing the set of
registered faces left every cached layout intact:

- `unregisterFontOutlines` dropped the slot, but text already laid out kept
  painting from outlines, with nothing left that could ever invalidate it —
  no load follows an unregister, so the counter never moved again.
- `registerFontOutlines` was the mirror image. Text already cached on the SDF
  tier never re-ran layout, so it never asked for an outline glyph, so the
  face never began loading and its status sat at `idle` forever.

Both now call `notifyGlyphReady`. An unregister that removes nothing does not,
so `disableMachineFontOutlines` sweeping every weight/style pair still costs
one invalidation per face it actually drops.

This was latent until the layout cache gained a structural key. Before that
it was keyed on run-array identity alone, and callers that rebuilt their runs
each frame missed on every lookup and re-derived the tier by accident.
