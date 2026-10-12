---
'@weasel-js/geom': patch
---

Adds API: `pathTrim` and `pathMerge` in `@weasel-js/geom/booleans`. `pathTrim(...paths)` removes from each path what the paths after it cover, so given back to front every piece is the part of its input left showing, and an input wholly hidden gives none. `pathMerge(paths, keyOf)` trims, then unites the pieces of the inputs `keyOf` gives the same key, which a caller keys by paint. Both return `BooleanPiece`s naming the inputs each piece came from. Uniting same-key pieces that do not touch into one path of several contours, where Illustrator's Merge leaves them apart, was an agent's judgment. No Boolean action runs either one yet.
