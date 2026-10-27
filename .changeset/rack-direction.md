---
'@weasel-js/diagram': patch
---

The `rack` look takes `direction: 'right' | 'down'`. `'right'` (the default) draws as before. `'down'` draws the main line as a column: each stage takes the main signal in at its top edge and sends it out at its bottom, side ports sit on its left or right edge facing out of it, a stage grows taller rather than wider to keep its side ports apart, and the look's reorder runs along `y`, so dragging a stage in `EffectEditor` moves it up or down the column. Under `'down'`, `side: 'below'` hangs the side stages on the column's right and `'above'` on its left; a collapsed skip's arc runs down the opposite edge. This adds API.
