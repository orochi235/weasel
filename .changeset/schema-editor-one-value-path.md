---
'@weasel-js/ui': patch
---

`PrefSchemaEditor` no longer lets two prefs share one value path. Where sections nest, under a node property schema or inside an `object` pref, a pref's key is checked against every pref in whichever section, so Add pref, a key edit, and a drop from the palette refuse or number a key another section holds. Under a node property schema a copy of a pref that holds a value is now an alias of it, and a copied section holds an alias of each such pref inside it; a copy beside its original is an alias too, where it used to take a numbered key that names no property. A schema that arrives holding one value path twice has both rows marked `key taken` in the structure tree, and a value typed in the preview becomes the default of both.
