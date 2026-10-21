---
"@weasel-js/diagram": patch
---

The container stencils carry palette glyphs. `ContainerStencil` takes an `icon`, and
`CONTAINER_STENCILS` sets one on each: a box with a title band for Container, a box with a left
header and two stacked lanes for Pool (rows), and a box with a top header and two lanes side by
side for Pool (columns). The glyphs are diagram's own `diagram` icon namespace, published as
`@weasel-js/diagram/icons` and found by the icons build plugin through the package's
`weaselIcons` field; an app that registers tables by hand adds this one beside the kit's.
