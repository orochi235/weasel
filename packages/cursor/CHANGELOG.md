# @weasel-js/cursor

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
