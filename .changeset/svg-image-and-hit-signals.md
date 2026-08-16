---
'@weasel-js/core': patch
'@weasel-js/svg': patch
---

Four more backlog fixes.

`@weasel-js/svg` reads and writes `<image>`. A new `SvgImageNode` holds the
`href` verbatim — an external URL or a `data:` URI, with `xlink:href` accepted
on the way in — plus a box that inherited transforms collapse onto and an
element-local rotation. `unpackSvgFiles` maps it onto the `kit:image` painter's
`data.image.src`, so a dropped SVG carrying raster content now keeps it instead
of dropping the element on parse. `preserveAspectRatio` is not modeled: the box
is taken literally and written back as `none`, and a non-`none` source warns.

`pickTopMostHit` resolves sibling z-order. An adapter can supply `getZIndex(id)`
or `compareZ(a, b)`; both compose with the existing parent/child collapse rather
than replacing it, so a child still beats its own ancestor whatever z the two
report. Without either, the hit list's own order decides, as before.

`useSceneTextEdit` supplies `setStyle`. Clearing a style flag that the *node*
sets is the one edit the additive run algebra can't express, and `useTextEdit`
declines it without a writer — so every scene-wired consumer silently refused
that toggle. Override the projection with `setStyle(data, style)` for a
non-default data shape.

The slops debug overlay draws handle halos at the real hit radius. Affordance
regions moved to screen-pixel radii, but this layer still scaled its circles by
the view, so at 4x zoom it drew a 32px halo over an 8px target — the one thing
a hit-test overlay must not do. Anchor slops now read the anchor radius rather
than the handle radius.
