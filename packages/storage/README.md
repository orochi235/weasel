# @weasel-js/storage

Keyed storage behind one async interface, `StorageAdapter`, with adapters for
IndexedDB, `localStorage`, `sessionStorage`, the URL hash and memory.
`openRecords` loads every record under a prefix into a `RecordCache`: reads
are synchronous from memory, writes land in memory at once and reach storage
on a debounce, and changes other tabs make arrive as `remote` changes.

Adapters that can read synchronously (`localStorage`, `sessionStorage`,
memory) also implement `listSync`, and `openRecordsSync` opens a cache from
one with no `await`.

A cache whose first read fails opens empty with `writable` false, and reads
again on a backoff (`retryMs`, doubling to `retryMaxMs`; `retryMs: false`
turns that off). `cache.read()` tries at once. When a read lands, the cache
reports the records as `remote` changes and starts writing, beginning with
whatever was set while it waited; those writes win over what it read.

`defaultStorage()` is IndexedDB under the database `'weasel'`, or
`localStorage`, with a warning, where IndexedDB will not open; it chooses once
per page. `fallbackStorage(preferred, fallback, label)` makes the same choice
between any two adapters, and `createDefaultStorage(preferred, label)` builds a
`defaultStorage` of your own over a different preferred adapter, such as
IndexedDB under another database.
