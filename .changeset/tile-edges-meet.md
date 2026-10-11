---
'@weasel-js/core': patch
---

Two `<Canvas paintInto>` tiles that share an edge now share it in device pixels at a fractional `devicePixelRatio`. The renderer rounded a tile's origin and its size separately, which at 1.25 or 1.5 could leave a one-pixel gap or overlap along the seam.
