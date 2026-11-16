---
'@weasel-js/paint-kinds': minor
---

Registering a paint kind under a built-in kind's id replaces it without a development warning.

`registerPaintKind` and `registerPaintKindLoader` take `{ fallback }` to mark a kind of your own as a default the same way.

<!-- entry: api behavior -->
