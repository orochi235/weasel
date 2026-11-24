---
'@weasel-js/renderer': patch
---

`commandsBounds`, and the tiles of a tiled layer, count a group whose `composite` clears what it leaves empty (`source-in`, `destination-in`, `destination-atop`, `copy`) as reaching everywhere inside its clip, so a tile away from its children is cleared too.

<!-- entry: fix visual -->
