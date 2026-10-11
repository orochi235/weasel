---
'@weasel-js/core': patch
'@weasel-js/svg': patch
---

`scene.mintId()` gives the id `scene.add` would give a spec with none, from the scene's `generateId` or the kit default. Group, duplicate, clone, paste, slice, the pen tool, an insert factory that returns no id, and an SVG drop now take their ids from it, so a scene with `generateId` holds one id scheme. Pasted nodes no longer carry a `paste-` prefix, and pen paths no `pn-` one. `Scene` gains a required member, so a hand-built `Scene` object needs `mintId`.
