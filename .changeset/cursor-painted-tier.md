---
"@weasel-js/cursor": patch
"@weasel-js/core": patch
---

The painted cursor tier, and cursors that tell the five shape tools apart.

A cursor that cannot be a CSS cursor is now drawn into the canvas instead of
being dropped. `resolveCursorTier` escalates when a glyph is sized in world
units, or past the 128 CSS px above which the browser silently discards the
image; `<Canvas>` then sets `cursor: none` and a screen-space layer paints the
glyph at the pointer. Tools never choose the tier — they declare what they
want, and a brush stays a brush across the radius where it stops being
expressible as a CSS cursor.

`brush` ships with it, sized by `worldRadius` so its ring measures the brush at
every zoom. A glyph that measures something declares `CursorGlyph.radius` to
name the circle being sized, and world-sized glyphs hold their line weight in
CSS px while their geometry scales.

`paint.ts` is the shared half: the baker and the painter both consume its
ordered paint ops, so the two tiers draw one glyph rather than two drawings
that resemble each other. The layer itself lives in core, which is where
`RenderLayer` and `Path` live.

rect, ellipse, line, star and polygon were all bare `crosshair` and so
indistinguishable while in use; each now shows a crosshair badged with its
shape, hotspotted on the cross. `Tool.cursor` on a built `Tool` widens from
`string` to `CursorSpec`, which it should have done when `ToolDef.cursor` did.

The `apps/draw` `cursor: copy` stub and its hand-rolled Alt listener are gone.
They advertised an add-anchor sub-tool that does not exist, so the affordance
was removed rather than relocated; `docs/TODO.md` records where it returns.
