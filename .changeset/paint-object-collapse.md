---
'@weasel-js/core': patch
'@weasel-js/svg': patch
'@weasel-js/ui': patch
---

Node paint is an object: `data.fill` is a `FillStyle`, `data.stroke` a `Stroke`

Each concept now has exactly one shape. `data.fill` holds a `FillStyle`,
`data.stroke` a whole `Stroke`, and `null` on either is an explicit "no paint"
where `undefined` takes the painter's fallback. Two new authoring helpers keep
hand-written node data short:

```ts
data: { path, fill: solid('#7fb069'), stroke: strokeOf('#1c1c1c', 2) }
```

**Breaking, with no compatibility path.** A document written against the old
shapes renders wrong rather than failing, which is accepted:

- `NodeFill = string | FillStyle` and `NodeStroke = string | Stroke` are gone,
  and so are the string branches of `resolveNodeFill` / `resolveNodeStroke`.
  A node holding `fill: '#f00'` now paints the default grey.
- `data.strokeWidth` is deleted. A stroke's width is `Stroke.width`.
- `data.color` — the legacy alias `kit:path` and the rect fallback read — is
  deleted. The fallback painter reads `data.fill` like everything else.
- `fill: 'none'` is now `fill: null`; `stroke: 'none'` is `stroke: null`.
- `NodeInkResult` is gone: a painter's `ink` returns `NodeInk` and nothing
  else. A painter returning `{ filled, strokeWidth }` no longer type-checks
  and its reach is read as zero.
- `@weasel-js/ui` drops `isStrokeObject`, which existed only to discriminate
  the union; `strokeColorOf` and `strokeWithColor` lose their string branches.
- `@weasel-js/svg`'s `strokeDataFromSvg` returns `Stroke | undefined` instead
  of a `{ stroke, strokeWidth }` pair, and stops flattening a plain solid
  stroke into a color. SVG's `fill="none"` imports as `fill: null`.

**A paint's alpha lives in `opacity`, one slot for every paint kind.** That is
the only slot a gradient or a pattern has, so it is the slot all of them use,
and the renderer multiplies a hex alpha by it — the two would fight if both
carried the value. `solid()` therefore moves an alpha channel out of the hex:
`solid('#ff000080')` is `{ color: '#ff0000', opacity: 0.502 }`.

The four setter actions follow: `setFillOpacity` / `setStrokeOpacity` write
`opacity` rather than splicing hex, so they now work on a gradient fill, which
they used to leave untouched. `setFill` / `setStroke` given a `color` recolor
the node's existing paint through the new `paintWithColor`, keeping its opacity
unless the picked color states an alpha of its own — and `setStroke` keeps the
stroke's width, cap, join and dash instead of replacing the whole value.

New exports: `solid`, `strokeOf`, `paintAlpha`, `paintWithAlpha`,
`paintWithColor`, `DEFAULT_SHAPE_FILL`.

`defaultNodeProperties` moves `data.fill` from a `color` leaf to a `paint` one
— a color control pointed at a `FillStyle` reads `undefined` off a gradient and
writes a bare string over it — and the `data.stroke` object leaf drops its
`fromScalar`, which had nothing left to lift.
