---
"@weasel-js/registry": patch
---

A `createEmitter` listener unsubscribed and resubscribed during an emit waits for the next emit, like any listener subscribing during one.

<!-- entry: rank=-5 fix -->
