---
'@weasel-js/d3': patch
---

An interrupted transition now ends. `selection.interrupt(name)` used to cancel only the tweens already running, so an item still waiting out its `delay` started anyway, and the transition's `end()` never resolved and fired neither `'end'` nor `'interrupt'`. A second transition of the same name starting on a node left the first one hanging the same way. Both now stop the node's item through the whole chain, and the transition fires `'interrupt'` and resolves `end()` once its other items finish. The `interrupt` docs also no longer claim that leaving out `name` interrupts every transition: it interrupts the unnamed ones, as it always did.
