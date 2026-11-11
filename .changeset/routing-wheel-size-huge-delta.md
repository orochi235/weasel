---
'@weasel-js/routing': patch
---

The Shift+wheel size step returns from a wheel event of any size, taking at most 1,000 steps for one event. A
delta past about 1e17 within a burst never left its stepping loop, since taking one wheel step's travel off it
changed nothing, and a large one took a step per 60 px of it.
