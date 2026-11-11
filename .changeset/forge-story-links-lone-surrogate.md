---
"@weasel-js/forge": patch
---

Story links in the tree and on index pages link a story id holding a lone surrogate rather than throwing, since `formatRoute` writes them.

<!-- entry: rank=-5 fix -->
