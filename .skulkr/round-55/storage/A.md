I wasn't allowed to write `.skulk/out/findings.md`, so the whole findings document follows. I read every file on the list; the tree's HEAD was `830b463cc1`, not the commit the brief named.

## A first read whose `subscribe` throws rejects instead of opening the cache empty, and ends the retry chain
- where: packages/storage/src/firstRead.ts:71 (attempt), with packages/storage/src/webStorage.ts:64 (subscribe) and packages/storage/src/records.ts:162 (buildCache)
- scenario: some browsers block site data, for example Chrome with "block all cookies" or a sandboxed iframe. There, reading `window.localStorage` throws a SecurityError.
  - `localStorageAdapter.subscribe` calls `keysNow(prefix)`, which calls `area()` synchronously, so `subscribe` throws too.
  - `attempt` calls `storage.subscribe?.(...)` before its `try`. The exception rejects `attempt()`, never reaches `failed()`, and no retry is scheduled.
  - So `openRecords({ storage: localStorageAdapter, prefix })` rejects. Its doc says a failed read opens the cache empty, with writing off, and retries.
  - `openRecordsSync` takes the `failed` path, because `listSync` throws. But when its first retry timer fires, `void read()` rejects unhandled and no further retry is made.
  - `createRecordCache({ storage: localStorageAdapter })` throws from its constructor at records.ts:162.
  - `fallbackStorage` hands localStorage over in exactly this setting. IndexedDB fails there too, so `defaultStorage()` resolves to `localStorageAdapter` without checking that it opens.
  - Should: treat a throwing subscribe as a failed read. Either move the call inside the `try`, or have webStorage's `subscribe` catch the error, as `readLocal` and `writeLocal` already do for the same refusal.
- evidence: read
- severity: medium

## A delete heard for a record the cache does not hold leaves `taken` unchanged, so a reconcile read started earlier brings the record back
- where: packages/storage/src/remote.ts:47-53 (apply) and :60-72 (reconcile)
- scenario:
  - The cache deletes `x`: `values` drops it and a delete is in flight.
  - Another writer sets `x = B`, which marks `x` contested.
  - Our delete lands, and `settled('x')` starts `reconcile`. It records `mark = taken.get('x')` and reads storage, which will return `B`.
  - Before that read resolves, the other writer deletes `x`. `apply` sees a delete of a name `values` lacks and hits `continue` before `taken.set(...)`, so the counter does not move.
  - The read resolves `B`. `taken.get('x') === mark` and `held` is false, so `apply([[key, B]])` puts `B` back in the cache and emits it as a remote change.
  - Storage holds nothing and the cache never writes, so it shows a deleted record until reload.
  - Should: count the heard change in `taken` before skipping it, so any change heard after the read began voids the read.
- evidence: read. This ordering needs the storage backend to deliver the delete before the get resolves, which a server-backed or event-driven adapter can do.
- severity: low

## `pickFile` never settles, and leaves its input in the document, where the browser does not fire `cancel`
- where: packages/storage/src/fileIO.ts:18-32 (pickFile)
- scenario: the user dismisses the file dialog in a browser that has no `cancel` event on file inputs (Safari before 16.4, older Chromium and Firefox).
  - The promise stays pending forever, so the doc's "null if the user cancelled" never happens.
  - The hidden `<input>` stays in `document.body`, so every canceled pick leaves another input behind.
  - Should: also settle `null` on a fallback, such as the window's next `focus` with no file chosen, or at least remove the input then.
- evidence: read
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

<!-- done: 3 findings, files read: 17 -->