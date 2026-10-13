---
'@weasel-js/ui': patch
---

A recent-colors store's subscriber that throws no longer stops the subscribers after it, or throws into `record` and `clear`. `createRecentColorsStore` now notifies through `createEmitter`, so the error goes to `console.error` as `weasel: a subscriber threw`. `@weasel-js/ui` now depends on `@weasel-js/registry`.
