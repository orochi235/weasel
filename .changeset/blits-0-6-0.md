---
'@weasel-js/core': patch
---

Core depends on `@msb235/blits` 0.6.0, where it pinned 0.4.0. An app that depends on blits 0.6.0 itself, as klieg does, now installs one copy rather than two. Nothing core exports changes.
