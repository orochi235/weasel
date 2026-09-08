---
'@weasel-js/core': patch
---

Layer groups: several consecutive layers render into one buffer and share one
effect pass.

`RenderLayer.effects` runs over a single layer, which is the wrong picture as
soon as a pass reads neighboring pixels — `blur(A over B)` is not `blur(A) over
blur(B)` — and it costs a buffer and a pass chain per layer. A consumer wanting
the world blurred and the HUD sharp had no way to say that the world was more
than one layer.

`LayerGroup` is that surface: `{ id, layers, effects?, alpha?, colorMatrix? }`,
passed to `<Canvas>` / `<SceneCanvas>` as `layerGroups`. Members are named by
`RenderLayer.id`, the same names `layerOrder` and `layerVisibility` use, so a
group can take in kit-built layers as readily as consumer ones. `drawLayers`
brackets each run of consecutive members in one `kind: 'group'` command; the
renderer's existing offscreen path does the rest.

Only consecutive members share a buffer, because anything drawn between two of
them has to land between them. A group split across the render order is drawn as
one bracket per run, with a warning — the picture is right, the declaration
probably is not. A hidden member, and a member that paints nothing this frame,
break no run.

`effects` also accepts a thunk, re-read on every frame the canvas paints, so an
animating radius costs no React render. A group that declares no effects, alpha
or color matrix emits no wrapper at all, and a frame with no groups allocates
nothing.

The side-scroller load test now blurs its six world layers on a head knock and
leaves its HUD, callouts and ending card sharp; the CSS `filter` it used to
reach for is gone.
