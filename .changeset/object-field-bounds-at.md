---
'@weasel-js/ui': patch
---

A `minAt` or `maxAt` on a number field of an `object` leaf now bounds it, as it already did a number leaf of its own. `PrefsForm`, and labkit's dialog for an object, read the bound from the values the form holds. `SelectionPanel` draws each such field with the loosest bound across the selected nodes and holds what it writes into each node to that node's own, for every field the edit changed; a field the edit left alone is stored as the node held it.
