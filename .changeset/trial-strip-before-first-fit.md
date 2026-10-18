---
'@weasel-js/labkit': patch
---

A canvas or stage trial whose view is not placed yet reads it as the default view its canvas paints meanwhile, so its zoom controls and its status strip (scale and FPS) are there from its first layout. The view is then fitted once, in the room the strip leaves, where before it was fitted to the taller box and fitted again when the strip arrived 30 px later.
