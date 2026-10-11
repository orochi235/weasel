---
'@weasel-js/core': patch
---

`createTiledLayer` drew every copy the view could hold however far out it was zoomed, hundreds of thousands of source draws per frame at a small scale, and never returned at a view scale of 0. Past 4096 copies in one draw it now draws none.
