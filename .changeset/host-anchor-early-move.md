---
'@weasel-js/core': patch
---

`useHostAnchor` follows a host that moves in the frame after it last moved, or in the frame after the panel mounts. A move that landed before the position watcher's first report was dropped, and the panel stayed where the host had been until something else recomputed it.
