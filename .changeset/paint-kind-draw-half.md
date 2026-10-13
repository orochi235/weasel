---
'@weasel-js/core': patch
---

core: a paint kind's draw slots are their own type now. `PaintDrawKind` holds `id`, `bind`, `inPoseFrame`, `toBoundsFrame`, and `programs`, and `PaintKindEntry` extends it with the slots an editor and a serializer read. `registerPaintKind` takes the same single object as before, and every other paint-kind export keeps its name and shape.
