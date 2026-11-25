---
'@weasel-js/registry': patch
---

A child extension registry's `entries()` puts an id it releases, which its parent still holds, at the parent's place at once.

<!-- entry: fix -->
