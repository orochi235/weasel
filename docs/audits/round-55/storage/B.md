# Audit round 55 — storage — findings

Note: the checkout's HEAD reads 830b463cc1, not the bfc55709b4 named in the brief; findings are against the tree as checked out.

## A first read whose adapter's `subscribe` throws rejects instead of opening empty, and stops retrying for good
- where: packages/storage/src/firstRead.ts:71 (attempt)
- scenario: `storage.subscribe?.(prefix, …)` runs outside the `try` that guards `storage.list`. `localStorageAdapter.subscribe` calls `keysNow` → `localStorage`, which throws `SecurityError` where site data is blocked. `openRecords({ storage: localStorageAdapter, … })` (or `defaultStorage()` falling back to localStorage after IndexedDB failed) then rejects instead of "opening the cache empty with writing off" as its doc promises. Via `openRecordsSync`, `listSync` throws → `failed` schedules a retry → the retry's `void read()` rejects unhandled, `failed` is never called, and no further retry is ever scheduled, so the cache never recovers even once storage becomes available. Should: treat a throwing subscribe like a throwing list (stop, call `failed`, return false).
- evidence: read
- severity: medium

## Reconciling a contested record compares structured-clone values by identity, so an IndexedDB Map/Date/typed-array record emits a spurious remote change
- where: packages/storage/src/remote.ts:70 (reconcile)
- scenario: a cache on `indexedDbAdapter` writes `name` = `new Map([...])`; another tab writes it while ours is in flight (contested); ours lands; `reconcile` reads storage back — a fresh clone — and `deepEqual(held, value)` is false for any `Map`, `Set`, `Date` or `Uint8Array` (deepEqual compares those with `Object.is`). The cache replaces its value with an equal copy and emits a `remote` change no other writer made. Should compare the way the substrate stores (structured-clone equality), not plain-object deepEqual.
- evidence: read
- severity: low

## A reconcile read that throws drops the contested record for good
- where: packages/storage/src/remote.ts:63-67 (reconcile) and :77-79 (settled)
- scenario: another writer changes `name` while ours is in flight → `contested`. Ours lands; `settled` deletes `name` from `contested` and calls `reconcile`; `storage.get` rejects (transient IndexedDB error, connection closed by versionchange). `reconcile` returns silently and nothing retries, so the cache keeps whichever value it held, possibly the losing one, until some later change to that record. Should: keep the name contested (or retry) when the read fails.
- evidence: read
- severity: low

## `flush()` on a closed cache still sends writes, though `close` says a write queued after it is never sent
- where: packages/storage/src/records.ts:192-205 (flush/close) with packages/storage/src/writeQueue.ts:109-111 (send)
- scenario: `await cache.close()`; then `cache.set('a', 1)` (values and emit still run) and `cache.flush()`. `writable()` ignores `closed`, so `send` writes `a` to storage. Meanwhile a second `close()` returns `queue.size === 0` without flushing, and the debounce timer skips closed caches. The same queued write is sent or not depending on the entry point. Should: one answer — `send` returns false when closed (or close's doc changes).
- evidence: read
- severity: low

## A transaction whose request errors rejects with `null`
- where: packages/storage/src/indexedDb.ts:137 (run)
- scenario: a request inside the transaction fails (e.g. a `DataError`/`ConstraintError`); its `error` event bubbles to `tx.onerror` before the transaction aborts, while `tx.error` is still `null`, so the promise rejects with `null` (the later `onabort` carrying the real error is ignored). The write queue then warns `could not write "…"; trying again null`, losing the cause. Should reject with the request's error (`(e.target as IDBRequest).error`) or wait for `onabort`.
- evidence: read
- severity: low

## `isJsonSafe` calls an object with symbol keys safe, though JSON drops them
- where: packages/storage/src/json.ts:62 (isJsonSafe)
- scenario: `localStorageAdapter.set('k', { [Symbol('id')]: 1, a: 2 })`: `Object.values` sees only string keys, so `jsonLossWarner` stays silent, while `toJson` writes `{"a":2}` and the symbol-keyed field is gone on read. Should: treat an object with own symbol keys as unsafe.
- evidence: read
- severity: low

## `pickFile` never settles, and leaves its input in the DOM, where `cancel` does not fire
- where: packages/storage/src/fileIO.ts:18-32 (pickFile)
- scenario: browsers without the file input `cancel` event (Safari before 16.4), or an `input.click()` made without user activation (which opens no dialog), run neither listener; the promise hangs forever and a hidden `<input type=file>` accumulates in `document.body` per call. Should: settle with null and remove the input on a fallback signal (e.g. window `focus` returning after the dialog).
- evidence: read
- severity: low

## A percent-encoded fragment reads as empty, and the next write wipes every record it held
- where: packages/storage/src/urlHashAdapter.ts:12 (readHashMap) with :55-57 (set)
- scenario: a shared link whose base64 fragment passed through something that percent-encodes `=`/`+`/`/` arrives as `#eyJ...%3D`. `location.hash` keeps `%3D`, `atob` throws, `decodeUrlHash` returns null, so every record reads as absent; the first `set` builds a map holding only its own key and `replaceState`s it, discarding the rest of the link's state. Should: `decodeURIComponent` the hash (or tolerate `%`-escapes) before `atob`.
- evidence: read (that link rewriters do this is inference, not measured)
- severity: low

## Files read
packages/storage/src/adapterContract.ts
packages/storage/src/defaultStorage.ts
packages/storage/src/fileIO.ts
packages/storage/src/firstRead.ts
packages/storage/src/index.ts
packages/storage/src/indexedDb.ts
packages/storage/src/json.ts
packages/storage/src/memory.ts
packages/storage/src/onLeave.ts
packages/storage/src/pbt.fixture.ts
packages/storage/src/records.ts
packages/storage/src/remote.ts
packages/storage/src/types.ts
packages/storage/src/urlHash.ts
packages/storage/src/urlHashAdapter.ts
packages/storage/src/webStorage.ts
packages/storage/src/writeQueue.ts

<!-- done: 8 findings, files read: 17 -->
