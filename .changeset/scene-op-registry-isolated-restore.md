---
'@weasel-js/core': patch
---

A scene with its own `opRegistry` restores a saved history only through that registry.

An op name it lacks is refused rather than taken, unbound, from the kit's default registry.

<!-- entry: fix -->
