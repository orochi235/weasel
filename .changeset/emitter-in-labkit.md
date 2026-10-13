---
'@weasel-js/labkit': patch
---

A subscriber that throws no longer stops the subscribers after it, or throws into whatever caused the notify, in labkit's stores: a trial clock's `subscribe`, `onWake`, and `onFrame`, the transport hold, the clock, camera, and panel-host registries, the annotation store, and a tiled surface's scope. Each now notifies through `createEmitter`, so the error goes to `console.error` as `weasel: a subscriber threw`. A subscriber added during a notify now waits for the next one. `@weasel-js/labkit` now depends on `@weasel-js/registry`.
