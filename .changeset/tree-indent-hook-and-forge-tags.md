---
'@weasel-js/theme': patch
'@weasel-js/forge': patch
---

`--wzl-tree-indent` is now a declared override hook: it appears in the token manifest, and setting it on a container sets the indent of each `Tree` level. Unset, the indent is one twisty plus one gap, as before. forge's package tags in the story tree now color themselves with `Badge`'s peer `tone`, replacing the per-package `--badge-edge` rules and the `fg-lib--*` classes.
