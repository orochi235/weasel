---
"@weasel-js/registry": patch
---

`createEmitter`: a listener unsubscribed and subscribed again during an emit, before its turn, waits for the next emit, as any listener subscribing during one does; it was called in that pass. An unsubscribe called again after its listener subscribed anew no longer removes the new subscription.
