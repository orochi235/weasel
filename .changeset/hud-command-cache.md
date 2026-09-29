---
"@weasel-js/hud": patch
"@weasel-js/core": patch
---

`attachHud` reuses a widget's draw commands across repaints until something
it draws from changes, instead of asking every widget for fresh commands on
every repaint. A static 10-glyph text widget used to rebuild its command, and so
re-lay out its glyphs, on every frame.

Additive. A widget opts in with the new `Widget.deps(ctx)`, which works like
`RenderLayer.deps`: the HUD reuses the previous commands while every entry is
`Object.is`-equal to the last call's, and also rebuilds when the widget's
bounds, the theme, the default font, the canvas size or the widget's focus
change. Every kit widget declares it, invalidated by its own setters and
pointer state. A hand-written widget without `deps` is drawn on every repaint,
as before; a widget declaring it must treat the commands it returned as
immutable. A window's `content` painter is still called on every repaint.

`@weasel-js/core` exports `depsUnchanged`, the comparison `RenderLayer.deps`
uses.
