---
'@weasel-js/renderer': patch
'@weasel-js/core': patch
---

A group command can be isolated, and a `LayerGroup` with `alpha` now fades as one surface. `GroupDrawCommand.isolate` is new API: the children draw into a buffer of their own and are composited once, so the group's `alpha` and `colorMatrix` apply to the finished picture and overlapping children no longer show through each other. A `LayerGroup` with an `alpha` under 1 or a `colorMatrix` and no `effects` is drawn that way, which is what its documentation already said; before, each member was faded on its own. This changes the pixels of any such group whose members overlap, and costs it a device-resolution buffer and one full-screen composite.
