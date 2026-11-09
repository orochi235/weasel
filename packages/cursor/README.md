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
back to that keyword, and with none declared it lands on `default`, the plain arrow.

Cursors ship as SVG with no bitmap fallback: Chrome rasterizes an SVG data-URI
cursor at device scale, so it is already crisp on a retina display. `bakeCursor`
throws above 128 CSS px rather than emitting a cursor the browser would drop
silently.

## Marks

A cursor that says what a tool does is two glyphs: the one you aim with, and a
mark in its corner naming the operation, as the shape tools' crosshairs and the
pen's add-anchor cursor do. They are composed, never drawn as one glyph:

```ts
cursorFor('crosshair', { mark: 'rect', fallback: 'crosshair' });
const INSERT: CursorSpec = { glyph: 'pen', mark: 'add', fallback: 'crosshair' };
```

A glyph that can carry a mark declares a `mark` slot: where the mark's box
lands, how large, and how far the glyph itself moves to make room (`shift`,
hotspot included). `markedGlyph` scales the mark into the slot as an `over`
layer, drawn after the glyph with its own halo, so the halo separates the mark
from whatever it sits on. This is the cursor counterpart of an icon's mark
(`docs/icons.md`, "A subject and a mark").

Marks live in `scripts/glyphs/marks.mjs`, each centered in a 10-unit box, as
filled silhouettes like every other cursor glyph. `cursorVariants()` lists every
glyph and every glyph-and-mark pair; the proofs and the gallery draw from it.

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
toolbar icons (core's, ui's and path-tools' icon tables, drawn by ui's `<Icon>`), which are
`fill: none` outlines in `currentColor`. An unfilled glyph over dark artwork is
a dark outline around a dark hole, and a baked image has no cascade to inherit a
color from. Share the authoring discipline, not the paths.
