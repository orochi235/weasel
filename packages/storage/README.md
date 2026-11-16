# @weasel-js/storage

Keyed storage behind one async interface, `StorageAdapter`, with adapters for
IndexedDB, `localStorage`, `sessionStorage`, the URL hash and memory.
`openRecords` loads every record under a prefix into a `RecordCache`: reads
are synchronous from memory, writes land in memory at once and reach storage
on a debounce, and changes other tabs make arrive as `remote` changes.

Adapters that can read synchronously (`localStorage`, `sessionStorage`,
memory) also implement `listSync`, and `openRecordsSync` opens a cache from
one with no `await`.

For one value read during a first render, such as a remembered panel width,
`readLocal(key)` reads it from `localStorage` now and `writeLocal(key, value)`
writes it, encoded as `localStorageAdapter` encodes it. Neither throws: where
the browser refuses storage, a read answers `undefined` and a write `false`.

A cache whose first read fails opens empty with `writable` false, and reads
again on a backoff (`retryMs`, doubling to `retryMaxMs`; `retryMs: false`
turns that off). `cache.read()` tries at once, and `cache.whenRead()` resolves
once a read has landed. When a read lands, the cache
reports the records as `remote` changes and starts writing, beginning with
whatever was set while it waited; those writes win over what it read.

A write storage rejects stays queued and is sent again on the same backoff,
and `flush()` resolves false until it lands; `pending(name)` says whether one
record's write is still queued or on its way, so a caller can tell which of a
flush's writes failed. While a write is queued, another writer's change to that
record is ignored; one heard while a write is on its way is read back from
storage once that write lands. With `retryMs: false`
a rejected write waits for the next flush.

A cache flushes when the page goes away or turns hidden, the last moment a
phone or a discarded background tab is sure to give. `onLeave(fn)` runs any
other pending write at the same moment; `{ capture: true }` runs it ahead of
the caches' own flush.

`defaultStorage()` is IndexedDB under the database `'weasel'`, or
`localStorage`, with a warning, where IndexedDB will not open; it chooses once
per page. `fallbackStorage(preferred, fallback, label)` makes the same choice
between any two adapters, and `createDefaultStorage(preferred, label)` builds a
`defaultStorage` of your own over a different preferred adapter, such as
IndexedDB under another database.

`downloadBlob(blob, filename)` saves a blob through the browser as a download,
and `pickFile(accept)` opens a file picker and resolves with the chosen file, or
`null` when it is canceled. `@weasel-js/editor` re-exports both.
