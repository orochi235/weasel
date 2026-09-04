# @weasel-js/cursor

## 1.4.0

### Patch Changes

- 04ea2e8: The painted cursor tier, and cursors that tell the five shape tools apart.
  
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
- b656ebf: Rotatable cursors, and a `CursorSpec` for the four fields that declare one.
  
  `bakeCursor` takes an `angle` in radians, quantized to 16 steps of 22.5°, and
  turns both the glyph and its hotspot. `Tool.cursor`, `Action.cursor`,
  `Action.activeCursor` and `AffordanceRegion.cursor` widen from `string` to
  `CursorSpec` — either a CSS keyword, which passes through untouched, or
  `{ glyph, size?, angle?, fallback? }`. Every cursor declaration written before
  this keeps working.
  
  Two glyphs ship with it. The selection's rotation ring now shows a real `rotate`
  cursor instead of a bare `grab`, and the resize corners show a `resize` arrow
  turned to the corner's actual axis — a rotated selection used to keep the
  unrotated diagonal, because CSS has four diagonal keywords and a rotation needs
  sixteen. The keyword remains as each spec's `fallback`.
- 36b6ee7: Add `@weasel-js/cursor` and give three tools real cursors.
  
  A cursor glyph is SVG path `d` strings tagged with a paint role plus a hotspot
  in glyph units — the one geometry form both a data-URI baker and a `Path2D`
  painter consume without translating. `bakeCursor` renders one to a
  `url(data:image/svg+xml,…)` string with the hotspot scaled to integer CSS px,
  and `cursorFor` memoizes that per name and size. The pencil, pen and eyedropper
  tools now show their own glyph instead of a shared `crosshair`.
  
  Cursors ship as SVG with no bitmap fallback: Chrome rasterizes an SVG data-URI
  cursor at device scale, so it is already crisp on a retina display. `bakeCursor`
  throws above 128 CSS px rather than emitting a cursor the browser would drop
  silently — that size is where a later painted tier will take over.
  
  Glyph geometry is authored in `scripts/glyphs/` and generated to resolved
  literals by `npm run gen:cursors`; `npm run proof:cursors` renders the baked
  assets over three backgrounds for inspection.
  
  New API: `bakeCursor`, `cursorFor`, `GLYPHS`, `haloFitsInBox`, `CursorGlyph`,
  `CursorPath`, `CursorGlyphName`, `BakeOptions`, and the register constants
  `CURSOR_INK`, `CURSOR_HALO`, `CURSOR_HALO_WIDTH`, `CURSOR_MAX_CSS_PX`.

## 1.4.0-pre.1

### Patch Changes

- 36b6ee7: Add `@weasel-js/cursor` and give three tools real cursors.
  
  A cursor glyph is SVG path `d` strings tagged with a paint role plus a hotspot
  in glyph units — the one geometry form both a data-URI baker and a `Path2D`
  painter consume without translating. `bakeCursor` renders one to a
  `url(data:image/svg+xml,…)` string with the hotspot scaled to integer CSS px,
  and `cursorFor` memoizes that per name and size. The pencil, pen and eyedropper
  tools now show their own glyph instead of a shared `crosshair`.
  
  Cursors ship as SVG with no bitmap fallback: Chrome rasterizes an SVG data-URI
  cursor at device scale, so it is already crisp on a retina display. `bakeCursor`
  throws above 128 CSS px rather than emitting a cursor the browser would drop
  silently — that size is where a later painted tier will take over.
  
  Glyph geometry is authored in `scripts/glyphs/` and generated to resolved
  literals by `npm run gen:cursors`; `npm run proof:cursors` renders the baked
  assets over three backgrounds for inspection.
  
  New API: `bakeCursor`, `cursorFor`, `GLYPHS`, `haloFitsInBox`, `CursorGlyph`,
  `CursorPath`, `CursorGlyphName`, `BakeOptions`, and the register constants
  `CURSOR_INK`, `CURSOR_HALO`, `CURSOR_HALO_WIDTH`, `CURSOR_MAX_CSS_PX`.
