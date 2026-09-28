---
"@weasel-js/core": patch
"@weasel-js/svg": patch
---

The `mesh-gradient` paint kind now loads on demand instead of shipping with
every import of `@weasel-js/core` (about 19 kB minified). A mesh fill that
arrives as data — a loaded document, an SVG import — draws nothing on the
first frame that meets it, starts the load, and `<SceneCanvas>` repaints it
when it lands. Importing anything from `@weasel-js/core/mesh` (`seedMeshPatch`,
`isMeshGradientFill`, `MeshEditor` in `@weasel-js/ui`, …) still registers it
at once.

New: `warmPaintKinds(kinds?)` loads kinds ahead of their first use and
resolves once they are registered; with no list it loads every kind that has
a loader. Await it before `renderSceneToPixels` or `serializeSvg` on a
document that may hold a mesh paint — both are synchronous and cannot wait for
a load. `registerPaintKindLoader(id, load)` declares a kind of your own the
same way: `load` resolves with its `PaintKindEntry`, and it runs the first
time the kind is looked up. New type: `PaintKindLoader`.

`<SceneCanvas>` now repaints whenever a paint kind registers, so a kind
registered after the canvas mounts draws without other help.
`serializeSvg` warns that an unregistered kind may only need loading, rather
than that it has no vector form.
