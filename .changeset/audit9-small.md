---
'@weasel-js/symmetry': patch
'@weasel-js/simulation': patch
'@weasel-js/parallax': patch
'@weasel-js/minimap': patch
---

Fix edge cases in symmetry counts, simulation clocks, tiled layers and the minimap fit.

- `@weasel-js/symmetry`: a radial, kaleidoscope or repeat group with a huge `count` is now held to `MAX_WALLPAPER_COPIES` copies, as a wallpaper already was. Before, a count of 1e7 built ten million transforms on every draw, and `Infinity` threw. This changes behavior: a count past the limit now draws fewer copies than it asks for, and a NaN count gives a kaleidoscope one wedge (a single mirror) where it used to draw nothing.
- `@weasel-js/symmetry`: where a short step puts the guide's step handle over the center, the step handle is now drawn on top, since that is the handle a press takes.
- `@weasel-js/simulation`: changing `useSimulation`'s `clock` no longer restarts a simulation the host stopped, or steps one that has settled. A running simulation carries on, on the new clock.
- `@weasel-js/parallax`: `createTiledLayer` now applies each source layer's `effects`, once over all of that layer's copies. Before, it dropped them. Sources now also keep their stacking order in every copy, so a later source draws over an earlier one where content bleeds into the next cell. Before, sources were drawn copy by copy.
- `@weasel-js/minimap`: the fit now goes through core's `fitViewToBounds`. A `{ kind: 'world' }` rect with a side that is not finite now falls back to identity scale, where before it got a scale of zero.
