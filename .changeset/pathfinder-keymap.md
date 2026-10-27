---
'@weasel-js/core': patch
---

`PATHFINDER_KEYMAP` puts the Pathfinder operations on held keys behind the leader Alt+P (`PATHFINDER_LEADER`): U Unite, I Intersect, M Minus Front, X Exclude, D Divide, C Crop, T Trim, R Merge. Holding a key previews the operation on the selection, releasing it runs the operation, and Escape before the release cancels it. The keys work with the leader tapped or held down. Each is a `holdPreview` of the operation, bound under its hold's id (`pathfinder.union.hold`), which is what a host rebinds it by. It carries only the holds, so the operations still come from the `paths` preset; install it with `<SceneCanvas ambient>`. New API.
