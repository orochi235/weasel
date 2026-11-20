---
'@weasel-js/storage': patch
---

A record cache over `localStorageAdapter` opens empty and read-only where the browser blocks site data, and keeps retrying its read.

`openRecords` resolves rather than rejecting, `createRecordCache` no longer throws, and `openRecordsSync` keeps trying on its backoff. The same holds for any adapter whose `subscribe` throws.

<!-- entry: fix -->
