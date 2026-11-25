---
'@weasel-js/registry': patch
---

A child extension registry lists an id it releases, and its parent still holds, at the parent's place in `entries()` at once, rather than moving it there at a later unrelated change.

<!-- entry: fix -->
