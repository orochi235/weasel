---
'@weasel-js/core': patch
'@weasel-js/svg': patch
---

`scene.mintId()` gives the id `scene.add` would give a spec with none, from the scene's `generateId` or the kit default. Group, duplicate, clone, paste, slice, the built-in shape tools, the pen tool, an insert factory that returns no id, and an SVG drop now take their ids from it, so a scene with `generateId` holds one id scheme. Ids no longer carry the `paste-`, `pn-`, or `kit-<kind>-` prefixes those paths used to write. `Scene` gains a required member, so a hand-built `Scene` object needs `mintId`.
