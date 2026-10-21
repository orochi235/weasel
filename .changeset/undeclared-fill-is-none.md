---
"@weasel-js/core": patch
"@weasel-js/svg": patch
---

A node with no `data.fill` now paints no fill. It used to paint gray (`#888`) in the built-in
painters and in `svgLeafFromKit`'s export, so a container from Cmd+G drew a gray box behind its
members, and a shape inserted without a fill showed up gray. This changes what existing scenes look
like: a node that relied on the gray default needs an explicit `fill`. `DEFAULT_SHAPE_FILL` is
removed, since nothing falls back to it any more, and `resolveNodeFill` takes no fallback argument.

The rect fallback painter no longer matches containers. A container without `clipFromPose` used to
take that painter's box as its silhouette and clip its members to it, which cut off the outer half of
their strokes, since a group's derived pose leaves stroke width out. A container now paints
nothing, even a `data.fill` it declares, and clips nothing; one that should clip says so with
`clipFromPose`, and a background behind a group's members is a leaf among them.
