---
'@weasel-js/core': patch
---

A leaf drawn as its rect pose alone, with no `data.path`, now has an editable
path: `classifyPathStorage` and `resolveEditablePathOf` read it as a rect
`data.path` the size of its pose, and its first edit writes one, as a drawn
rectangle's does. Trim segment, Extend to next path, path edit, and the other
path commands reach it. `EditableShape` takes the node's `kind`, since only a
leaf drawn by the kit's rect fallback qualifies.
