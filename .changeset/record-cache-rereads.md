---
"@weasel-js/storage": patch
"@weasel-js/prefs": patch
"@weasel-js/labkit": patch
---

A record cache whose first read fails now recovers. This changes behavior: `openRecords` and `openRecordsSync` used to answer a failed read with a cache that stayed empty and read-only until the page reloaded. It now reads again on a backoff, starting at `retryMs` (default 1000 ms) and doubling to `retryMaxMs` (default 30000 ms), and `cache.read()` tries at once. When a read lands, the cache holds the records, reports them to listeners as one batch of `remote` changes, hears other writers, and turns `writable` on. Records set or deleted while it waited win over what was read and are then written, and a delete made while unread is now queued even though the cache holds no such record. `retryMs: false` keeps the old behavior, and a cache its opener stopped with `stopWriting()` stays read-only and stops retrying. `RecordCache` gains the `read()` method, which anything implementing the interface by hand must add.

A prefs store opened while its storage was away therefore shows the stored values and starts persisting once the read lands. `PrefsStore` gains `read()` to try at once, `writable` turns true when it does, and a store with migrations now also stops persisting when the records that arrive late carry a version newer than the build knows. Migrations are not rerun over records that arrive late.

labkit's lab store opens its records with `retryMs: false`, so a lab whose storage could not be read stays empty and unsaved for the session, as before. `<Persistence>` uses the default and recovers.
