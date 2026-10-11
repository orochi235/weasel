---
'@weasel-js/ui': patch
---

`PrefSchemaEditor` takes `unplaced`: a `PrefGroup` of nodes that have no place in the schema yet, each whole already with its key, name, description, and default. They are drawn under the structure tree as a second tree, and a row is dragged from there into the structure tree or onto the live preview, where it lands as it is; a group dragged brings what it holds. A leaf leaves the list once the schema holds a leaf of its key.

This replaces the `stored` prop, which listed stored values no leaf described and opened a dialog to add a leaf for one. `stored` is removed.
