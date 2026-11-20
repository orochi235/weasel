---
'@weasel-js/registry': patch
---

A reflectable's `set` keeps the rank of the registrant it replaces, so a later lower-rank `push` no longer goes live over a higher-rank one.

<!-- entry: fix -->
