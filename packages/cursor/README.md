# @weasel-js/cursor

Tool cursors as authored glyphs.

```ts
import { cursorFor } from '@weasel-js/cursor';

const tool = defineTool({
  id: 'pencil',
  cursor: cursorFor('pencil', { fallback: 'crosshair' }),
});
```

A glyph is a set of SVG path `d` strings with paint roles and a hotspot in
glyph units. `cursorFor` bakes one into a CSS cursor value and memoizes it.

**Always pass a `fallback`.** If the browser rejects the image the element falls
back to that keyword, and with none declared it lands on `auto`.

Cursors ship as SVG with no bitmap fallback: Chrome rasterizes an SVG data-URI
cursor at device scale, so it is already crisp on a retina display. `bakeCursor`
throws above 128 CSS px rather than emitting a cursor the browser would drop
silently.

## Authoring a glyph

Geometry lives in `scripts/glyphs/` and is generated to resolved literals:

```
npm run gen:cursors      # regenerate src/glyphs.ts
npm run proof:cursors    # render every glyph over three grounds
```

Proof a change before committing it. The proof sheet draws each glyph at 11x for
geometry and embeds the baked asset at 24 and 16 px — those are separate checks
and they disagree, which is the point. A glyph that reads at 11x and turns to
mush at 24 has failed.

The register is a filled silhouette with a white halo, deliberately unlike the
toolbar icon sets (`@weasel-js/ui`'s `ICON_PATHS`, core's tool icons), which are
`fill: none` outlines in `currentColor`. An unfilled glyph over dark artwork is
a dark outline around a dark hole, and a baked image has no cascade to inherit a
color from. Share the authoring discipline, not the paths.
