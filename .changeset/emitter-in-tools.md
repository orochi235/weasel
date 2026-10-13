---
'@weasel-js/core': patch
'@weasel-js/animator': patch
---

A listener that throws no longer stops the listeners after it, or throws into whatever caused the notify, in these stores: `createRigEditState`, the bone, weight, and slice tools' overlays, the view registry, a canvas renderer lease's `subscribeRestored`, and the animator's `onTick`. Each now notifies through `createEmitter`, so the error goes to `console.error` as `weasel: a subscriber threw`; `onTick` already kept going, and its message changes to that one. A listener added during a notify now waits for the next one.
