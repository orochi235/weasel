---
'@weasel-js/storage': patch
---

A record cache no longer loses a write its adapter rejects. The write stays queued and is sent again on a backoff (`retryMs`, doubling to `retryMaxMs`, the options a failed first read already used), unless a newer write to the same record has been queued since. `flush()` resolves false until it lands, where the flush after a rejected write used to resolve true with storage never having taken the value. With `retryMs: false` a rejected write waits for the next flush. The warning is logged once per outage, and now reads `could not write "<key>"; trying again`.

A cache also keeps its own write over another writer's change that arrives while that write is on its way to storage. Before, only a write still waiting on the debounce was protected, so a tab could show the other writer's value while storage held its own.
