---
'@weasel-js/loupe': patch
'@weasel-js/hud': patch
---

A subscriber that throws no longer stops the subscribers after it, or throws into whatever caused the notify, in a canvas source's `subscribeFrame` and a HUD's `subscribeFocus` and `subscribeFrame`. Each now notifies through `createEmitter`, so the error goes to `console.error` as `weasel: a subscriber threw`. Both packages now depend on `@weasel-js/registry`.
