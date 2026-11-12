---
"@weasel-js/quantity": patch
---

Removing a `registerDisplayKind` registration brings back the one it replaced, as `registerUnit` does, instead of dropping straight to the built-in.

<!-- entry: fix -->
