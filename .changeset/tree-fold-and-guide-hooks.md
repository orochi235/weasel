---
'@weasel-js/theme': patch
---

`--wzl-tree-fold-size` and `--wzl-tree-guide` are declared override hooks. `Tree` already read both, with fallbacks of 16px and `--wzl-fg-subtle`; they were missing from the token manifest, so nothing listed them as settable.
