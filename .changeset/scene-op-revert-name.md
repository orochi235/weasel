---
'@weasel-js/core': patch
---

An inverted scene op is named `revert:<kind>`, so its `name` and `args` describe the revert and rebuild it, not the edit it undoes.

A sync layer that inverts the ops `history.observe` reports for an undo can now ship them as `{ name, args }` and a restored history rebuilds them as reverts.

<!-- entry: fix -->
