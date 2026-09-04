---
"@weasel-js/core": patch
---

Alt-drag-to-duplicate shows the duplicate cursor.

`clone` declared no cursor, so the one gesture in the kit that copies instead
of moving looked exactly like a move until you released. It now declares
`cursor: 'copy'` and `activeCursor: 'copy'`, which needs no modifier gate of
its own: the select tool binds clone behind `mods: { alt: true }`, so the hover
pump predicts the action — and shows the cursor — only while Alt is held over a
body, and drops it the moment Alt is released.

This replaces the `apps/draw` stub that arc 4 deleted. That stub forced
`cursor: copy` from a CSS rule fed by a hand-rolled Alt listener, scoped to
path-edit mode and applied over the whole canvas including where nothing would
happen. The affordance now shows wherever Alt-drag actually duplicates, in
every mode, through the cursor pipeline.

`AffordanceRegion.cursor` and a layer claim cannot express this — neither
`affordanceAt` nor `RenderLayer.hitTest` receives the event, so `Action.cursor`
is the kit's only modifier-gated cursor channel.
