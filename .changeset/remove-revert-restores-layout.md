---
'@weasel-js/core': patch
---

Undoing a removal from a history read back from JSON restores each node's function fields from their registry
keys even where the saved node still holds something under that field. A layout strategy, an object, came back
from JSON with its methods gone, so a page run (or any container with a registered layout) returned without its
layout, and the scene's next `toJSON` threw.
