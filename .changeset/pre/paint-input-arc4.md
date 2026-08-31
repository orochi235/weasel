---
"@weasel-js/core": patch
"@weasel-js/ui": patch
---

Add `PaintInput`, a control that edits a whole `FillStyle`.

A kind bar over a per-kind body, driven by the paint-kind registry rather than
a fixed list, so a consumer's registered kind appears in the bar and renders
that entry's `Editor`. `SelectionPanel`'s `paint` leaf renders it in place of
the chip that showed a gradient as indeterminate and wrote a solid over it on
first touch — so the checkerboard now means a mixed selection and nothing else,
and a gradient stroke is editable rather than merely paintable.

Switching kinds keeps a per-kind memory for the control's lifetime, so
linear -> solid -> linear comes back with its stops instead of the ramp
`withGradientKind` cannot carry.

`PatternPicker` moves from WeaselDraw into `@weasel-js/ui`, which now depends
on `@weasel-js/svg` for its tile previews.

The bar offers **None**: "what kind of paint is this?" takes no-paint as an
answer. `setFill` and `setStroke` accept `paint: null` to write it — a fill
becomes `null`, and a stroke goes away entirely rather than keeping a width
that draws no ink. `PaintKindEntry` gains an optional `icon`, and the five
built-in kinds carry glyphs so six segments fit a property row.

`FILL` and `STROKE` are now peer sections: the `appearance` group goes headless
and `data.fill` becomes a block leaf. The stroke's paint is no longer paired
with its width — a whole paint editor cannot share a row with a slider.
