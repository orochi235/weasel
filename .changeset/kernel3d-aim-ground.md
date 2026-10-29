---
'@weasel-js/kernel3d': patch
---

A kernel3d view drawn into a 2D view now outlines its footprint on the ground, the plane `createInsert` drops nodes onto, in place of the plane z = 0. A 2D view's aim drawn into a kernel3d pane, and a drag across one, lands on that same ground. In kernel3d's default y-up world, z = 0 is an upright wall, so a camera looking down at the floor used to outline nothing useful in a 2D view; its footprint now lies on y = 0, with world x and z carrying the 2D x and y. `aimOf3d` and `aimSpace3d` take an optional third argument, `{ up }`, read as `createInsert`'s `up` is (default +y); pass `{ up: { x: 0, y: 0, z: 1 } }` to keep the old z = 0 placement. The new `Aim3dOptions` type names it.
