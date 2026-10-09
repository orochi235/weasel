---
"@weasel-js/ui": patch
---

`PrefSchemaEditor` takes `stored`, the values the app saves under the schema. Given, the structure pane splits: the tree above, and below it, behind a resize handle, every stored value no leaf describes. Choosing one opens the add dialog filled with its key, a name made from the key, and a kind read off the value, and adds the leaf where the value lives, with the stored value as its default, making any group on the way.
