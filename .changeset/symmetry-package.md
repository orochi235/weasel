---
"@weasel-js/core": patch
"@weasel-js/geom": patch
"@weasel-js/routing": patch
"@weasel-js/svg": patch
"@weasel-js/symmetry": patch
---

New package, `@weasel-js/symmetry`: live symmetry groups. A group's copies (a mirror at any angle, both axes, a point, radial, kaleidoscope, or a repeat with an optional glide) are drawn from its real children. Every edit to a child therefore reaches every copy, a click on a copy selects the child it copies, and `bakeSymmetry` turns the copies into real nodes. `createSymmetry(scene).contribution` draws the guide with draggable center, axis, and step handles, sends every tool's shapes into the active group, and keeps a path that is its own image under its group symmetric while its anchors are dragged or nudged.

Core gains what the package is built on, and each piece is usable on its own:

- `ContainerNode.copiesFromPose`: a container draws its subtree again under each affine it returns. Hit tests reach into the copies, and the clip travels with each one. Additive.
- The `insertInto` dep: the container the `insert` dep puts new nodes into.
- The `pathSymmetry` dep: transforms that anchor drags and nudges keep a path symmetric under.

`@weasel-js/geom` adds `anchorSymmetry`, `anchorSymmetries`, `translateAnchorsSymmetric`, and `moveHandleSymmetric`. `@weasel-js/svg` writes a container's copies as transformed groups.
