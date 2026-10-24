---
"@weasel-js/routing": patch
"@weasel-js/core": patch
---

A contribution can declare `watch(changed)` beside its `deps`. A dep source is a thunk nothing else can watch, so an `ActionBar` button showing an action's `active` or `enabled` state kept whatever it last read when the source changed without the scene or selection changing. A host subscribes `watch` while the entry is installed and tells the dep registry whenever it fires, and the chrome re-reads.
