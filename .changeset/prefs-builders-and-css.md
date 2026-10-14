---
'@weasel-js/prefs': patch
---

Additive. `pref` builds a schema in short form: `pref.group(name, children)`, `pref.section(name, members)`, and `pref.number`, `pref.boolean`, `pref.string`, `pref.color`, and `pref.enum` for leaves, each returning the plain data the literal would hold. `prefsCss(store)` writes a store's values as CSS custom properties, with a block inside `:where()` for each choice of options a split value tells apart, and `prefsCssAttributes(store)` gives the attributes that pick those blocks.
