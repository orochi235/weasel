---
'@weasel-js/ui': patch
---

`PrefSchemaEditor` handles several nodes in two more places. In the Unplaced tree, Cmd-click adds a row to the selection and shift-click takes a range, rows selected in the structure tree stay selected, and a drag of several selected rows carries them all. Add alias works with several prefs selected: it adds an alias of each, together after the one picked last, and is off while any of them has no alias to make.
