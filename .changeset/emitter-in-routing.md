---
'@weasel-js/routing': patch
---

A subscriber that throws no longer stops the subscribers after it, or throws into whatever caused the notify, in `createPointerStore`, `createLongPressStore`, and a dispatcher's `subscribe`. Each now notifies through `createEmitter`, as do the actions, dep, and active-tool registries, which already kept going; the error goes to `console.error` as `weasel: a subscriber threw`. A subscriber added during a notify now waits for the next one. `@weasel-js/routing` now depends on `@weasel-js/registry`.
