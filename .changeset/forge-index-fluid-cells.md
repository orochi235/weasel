---
'@weasel-js/forge': patch
---

An index page no longer collapses a story that sizes itself from its container — a slider, a tiled workspace — to a 10px sliver. A padded story's cell now takes the column's width, as a page would give it, and a centered cell keeps a minimum width of `min(100%, 20rem)` while still hugging anything wider.
