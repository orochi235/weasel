---
'@weasel-js/animator': patch
---

A timeline's `subscribe` and `subscribePlayback`, and `animator.watch`, now notify through `createEmitter`. Each already kept going past a listener that throws; the logged message changes to `weasel: a subscriber threw`. A listener added during a notify now waits for the next one, where it used to be called in the same pass.
