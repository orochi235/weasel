---
'@weasel-js/theme': patch
'@weasel-js/ui': patch
---

Adds `--wzl-tree-leaf-indent` (default `0`), a declared override hook: how far in from its branches' glyphs a `Tree` with `guides` sets a row that folds nothing. The schema editor's structure tree sets it to 4px, so a pref's name stands in from the glyphs of the groups around it.
