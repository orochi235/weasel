---
'@weasel-js/paint': patch
'@weasel-js/core': patch
'@weasel-js/svg': patch
'@weasel-js/ui': patch
'@weasel-js/diagram': patch
---

A node's `fill: 'inherit'` or `stroke: 'inherit'` now takes its nearest enclosing container's fill or stroke whole. If that container inherits too, the lookup keeps going up, and at the root it is none. A container's fill and stroke are only a source: the built-in `kit:shape` and `kit:path` painters no longer paint a container's own fill or stroke, and its interior is no longer hit for picking.

The scene's draw wrapper passes the resolved paint to painters as `ctx.inherited` on `NodePaintCtx`, and pickers pass it on `NodeInkCtx`. A painter's memo has to key on it: `nodeMemo` takes an extra reference-compared key for this, and the paint stays the same object while its sources are unchanged. **A custom painter that does not read `ctx.inherited` paints an `'inherit'` field as none.** Pass the field and `ctx?.inherited?.fill` to `resolveFill` (or `resolveStroke`) to pick it up. `diagram:shape` reads it. Readers outside a painter can use `inheritedPaintIn(scene, node)` and `withInheritedPaint(data, inherited)`, and `paintAbove(scene, node)` says what inheriting would paint.

SVG import turns a `<g>`'s fill and stroke into its container's, and a child that sets none of them gets `'inherit'`. A gradient, or a child faded further than its group, is still copied onto the child. Export writes a container's paint on its `<g>` and leaves the attribute off a child that inherits a solid one.

`SelectionPanel` adds an Inherit choice beside None for a node's fill and stroke, showing the paint it would take. `PaintField` and `PaintInput` offer it when given `inherit` (`{ paint, onInherit }`); their `value` may be `'inherit'`, and `onChange` is unchanged.
