# window

A draggable, resizable frame drawn in WebGL over a weasel canvas.

The frame paints a titlebar, the resize bands, a border ring and a close box —
and deliberately leaves the interior unfilled. Interiors come from the widget's
optional `content` painter, which `attachHud` draws beneath every widget frame
and clips to `contentRect`. That painter is the only place hud sees scene data;
`HudDrawCtx` stays data-free so widgets remain renderable headlessly.

Content is drawn in the *same* registered layer as the frames, not a second
one. Registration order is draw order and the last-registered layer wins, so a
separately-registered content layer created after `attachHud` would paint over
its own frame. Sharing the layer also makes frame/content desync impossible
during a drag.

Painter commands are in **absolute canvas coordinates**. The group they land in
carries a clip but no transform, so a painter that treats `rect`'s origin as
`(0, 0)` silently draws nothing.

The frame must be GL, not DOM. A DOM border over GL content moves on the
browser's paint schedule while the content moves on the rAF schedule, so the
two separate by a frame and the content visibly slides inside its own border
during a resize.

## Zones

`zones.ts` holds the geometry: which of the eight resize bands, the titlebar,
the close box or the interior a point falls in, and what a drag from each does
to the bounds. Two things there are easy to get wrong and are pinned by tests —
corners resolve before edges, and west/north clamping holds the opposite edge
rather than clamping the extent, which would otherwise walk the window sideways
once it bottoms out.

The `close` hit zone is the full titlebar-height strip at the right, wider than
the drawn glyph. That is a forgiving hit target, not a mismatch.

## Interior presses

The widget claims every press, including in the interior, and does nothing with
the ones it doesn't use. An unclaimed press would reach the scene underneath and
act on whatever sits there — which, for a magnifier, is not what the user is
looking at. Interacting *through* a window needs hit-test re-projection that
`createViewportLayer` does not yet have.

## Related

- [`../../loupe`](../../loupe) — the first consumer: window plus a magnified lens.
- [`@weasel-js/core` viewports](../../../../core/src/features/viewports/README.md) — the lens itself.
