---
'@weasel-js/core': patch
---

Move, resize, rotate, clone, nudge, and duplicate read and write each node's pose through its own descriptor (`PoseDescriptor.forNode`). Rotate measured through it and wrote through the unspecialized one, move used it only in its layout pass, and the rest never asked, so a node whose chrome was drawn from its specialized bounds was resized, translated, and copied as the default shape.
