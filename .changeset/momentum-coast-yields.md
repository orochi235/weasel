---
'@weasel-js/core': patch
---

`momentum`: a coasting node that something else moves or deletes, an undo included, now drops out of the coast. The coast used to go on writing its pose every frame and record a `'flick'` transform for it at rest, over whatever the other writer did. A dropped node records nothing; the rest of a multi-node flick carries on.
