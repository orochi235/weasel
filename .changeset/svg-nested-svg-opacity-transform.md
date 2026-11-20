---
'@weasel-js/svg': patch
---

`parseSvg` keeps a nested `<svg>`'s `opacity`, reading the element as a group that carries it, and moves its children by its `transform`.

<!-- entry: fix visual -->
