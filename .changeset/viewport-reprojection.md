---
'@weasel-js/core': patch
---

Viewport layers can now answer where a screen point lands inside them.
`createViewportLayer` returns a `ViewportLayer`, adding:

```ts
layer.reproject(outer, dims, screen)   // → inner-world point, or null if outside
viewportsAt(layers, outer, dims, screen)  // → topmost viewport containing it
```

`bounds` is already a pure function of `(outer, dims)`, so re-projection
recomputes the exact rect the frame painted rather than a remembered one — no
stored state and nothing to go stale. Right and bottom edges are exclusive, so
adjacent viewports never both claim a pixel.

This deliberately does **not** touch the dispatcher, which the previous
docstring promised it would. Tools still target the outer view; a consumer that
wants a click inside a viewport to mean something calls `reproject` from its own
handler. Making tools work *inside* a viewport raises questions this primitive
does not answer — which view a pinch zooms, what a drag leaving the rect does —
and is tracked as its own item.
