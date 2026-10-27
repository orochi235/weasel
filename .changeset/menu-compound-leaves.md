---
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

`resolveSchemaMenu` now draws the leaves it used to leave out. An `object` is a submenu of its fields, each edit writing the object whole; a `list` is a submenu of its entries (`Cap 1`, `Cap 2`) with rows that add an entry and remove the last within `minItems`/`maxItems`; a `map` is a submenu of its entries named for their keys; a `union` is a submenu of its variants as radio rows, then the fields of the variant it holds; a `field` is a submenu of the schema's value-holding leaves it may name. A `paint` is a color row while it is solid or none, and reads as its kind otherwise. A section among an object's fields adds nothing to their paths. An app-defined leaf is drawn by the new `MenuSources.customRows`, given the row key, the path, and the `values`/`onChange` where the leaf sits (`MenuCustomAt`), and is left out without it. Adds API; a menu over a schema holding these leaves now shows rows it did not before.
