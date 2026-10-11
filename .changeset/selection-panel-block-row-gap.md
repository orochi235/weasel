---
'@weasel-js/ui': patch
---

`SelectionPanel` leaves the gap under a row it draws across the section, a `label`, a `separator`, or a `block` leaf, that it leaves under every other row. There was none, so the row under it started flush against it, and in `PrefSchemaEditor`'s preview a selected label's outline ran into the label of the next row.
