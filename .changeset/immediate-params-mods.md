---
'@weasel-js/routing': patch
---

An immediate action gets `params.mods`, `params.roles` and `params.viewId` on every kind of input, not only pointer input. Keys, held keys, wheels, pinches, multitouch taps, drops, and pastes now carry them as clicks do, and `params` is no longer `undefined` when the binding has none.

<!-- entry: fix -->
