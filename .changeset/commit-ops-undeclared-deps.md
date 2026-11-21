---
'@weasel-js/core': patch
---

`commitOps` commits for an action that declares only the deps it uses, without reading `operands` or `applyOps` it never declared.

<!-- entry: fix -->
