---
"@weasel-js/registry": patch
---

Calling a `createEmitter` unsubscribe again after its listener subscribed anew no longer removes the new subscription.

<!-- entry: fix -->
