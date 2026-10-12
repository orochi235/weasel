---
'@weasel-js/core': patch
---

A container can declare the unit system its contents are written in. `ContainerNode.units` holds a `UnitScope` from `@weasel-js/quantity`: set it on the spec passed to `scene.add`, or later with `scene.setUnits(id, scope)`, which is one undo step and clears the scope when passed `null`. It rides through `toJSON` and `sceneFromJSON`, undo of a removal, copy and paste, and `reconcileSpecs`, which writes a changed scope in place. `sceneUnitScopes(scene, id, root)` returns the scopes enclosing a node, outermost first, which is what `resolveScoped` and `formatScoped` take; before this a consumer kept each scope beside the scene and handed `scopesOf` its own lookup. This adds API. Nothing in the kit reads the scope yet: grids and property fields still resolve against the one unit system they are given. `LayoutMove` and `LayoutFrame` moved to their own module and are exported from the same places.
