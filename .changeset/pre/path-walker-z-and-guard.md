---
'@weasel-js/core': patch
---

Fix two path-walker bugs that produced wrong geometry with no error.

`tessellate` treated `Z` as a no-op, so a command following a close flattened
from the last point drawn rather than from the subpath start — SVG puts the pen
back at the start. `pathDistanceToPoint` dispatched through an `if`/`else if`
chain with no final `else`, so an unrecognized command code left the coordinate
cursor unadvanced and silently misaligned every later read; it now throws.
