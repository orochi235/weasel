---
'@weasel-js/forge': patch
---

A subscriber that throws no longer stops the subscribers after it, or throws into whatever caused the notify, in forge's stores: a channel's `on`, the story clock, the trial clocks and trial frames, the answer book, the story changes, and the tree reveal. Each now notifies through `createEmitter`, so the error goes to `console.error` as `weasel: a subscriber threw`. A subscriber added during a notify now waits for the next one. `@weasel-js/forge` now depends on `@weasel-js/registry`.
