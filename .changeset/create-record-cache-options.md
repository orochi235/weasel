---
'@weasel-js/storage': patch
---

Adds API: the `CreateRecordCacheOptions` type, what `createRecordCache` takes: `RecordCacheOptions` plus `initial`, the records the cache opens holding, and `writable`, which opens it with writing off when false.
