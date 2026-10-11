---
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

A dep registry can be listened to: `subscribe(listener)` hears a source registered or released anywhere in its tree and an owner's `changed()`, which says a source's value changed. `<SceneCanvas>` calls `changed()` when its scene or its selection changes. `ActionBar` and an action leaf's button listen, so a button whose `enabled` or `active` state reads the selection now follows it without anything else re-rendering the chrome. A dep source you publish that changes on its own calls `useDepRegistry().changed?.()` when it does. Both methods are optional on `DepRegistry`, so a hand-built registry with only `register` and `get` still fits.
