# @weasel-js/storage

## 1.14.1

### Patch Changes

- @weasel-js/registry@1.14.1

## 1.14.0

### Patch Changes

- @weasel-js/registry@1.14.0

## 1.13.0

### Patch Changes

- @weasel-js/registry@1.13.0

## 1.13.0-rc.0

### Patch Changes

- @weasel-js/registry@1.13.0-rc.0

## 1.12.0

### Patch Changes

- 91a1d84: `useVisibleRaf`, `defaultStorage` and the deprecated `cornerPoint` now carry a description, which
  editors show on hover and the package pages show beside the name.
- @weasel-js/registry@1.12.0

## 1.11.1

### Patch Changes

- @weasel-js/registry@1.11.1

## 1.11.0

### Patch Changes

- Updated dependencies [304f53a]
- Updated dependencies [63b310c]
- Updated dependencies [1be2ea9]
  - @weasel-js/registry@1.11.0

## 1.10.1

### Patch Changes

- b8bfb2d: History and its journals, `createSelectionStore`, a record cache's `subscribe` and `onOverruled`, `createPaintedCursorState`, and `useFrameClock` notify through `createEmitter()` from `@weasel-js/registry`, as every other store in the kit does. Each of these packages now depends on `@weasel-js/registry`.
  
  What changes for a consumer: a listener that throws no longer throws into whatever caused the notify, such as `applyOps`, `setSelection`, `set`, or a frame of the clock. The error goes to `console.error`, and the listeners after it still run. A notify also walks the listeners held when it began, so one added during a pass waits for the next.
- Updated dependencies [886380f]
  - @weasel-js/registry@1.10.1

## 1.10.0

### Patch Changes

- 09755da: Adds API: the `CreateRecordCacheOptions` type, what `createRecordCache` takes: `RecordCacheOptions` plus `initial`, the records the cache opens holding, and `writable`, which opens it with writing off when false.

## 1.9.4

### Patch Changes

- e437227: `createIndexedDbAdapter` opens its database again after losing it. One failed or blocked open used to be kept for the life of the page, so every later read and write failed the same way and a record cache's retries could never land; the same held once the browser closed the connection. The adapter now opens a new connection on the next call. It also closes its connection when another tab asks to delete or upgrade the database, which used to stay blocked for as long as this tab was open.
- c19221d: `localStorageAdapter` reports another tab's `localStorage.clear()`. A clear arrives as one `storage` event naming no key, which the adapter ignored, so a record cache in this tab went on holding values storage no longer had. For a prefs store with migrations, the next single write then left storage with one record and no `$version`, and the following load ran every migration over a value already in the current shape. Subscribers now hear a delete for each record under their prefix that the clear removed, and the prefs version watch writes `$version` back.
- 2cc1b5a: Prefs migrate records that arrive after the open. When another writer leaves an older `$version`, as an older build open in a second tab does, the store runs its migrations from that version over the records other writers changed and persists the result; before, it ran on the older-shape records for the rest of the session. Records a failed first read delivers late are migrated the same way, and a value set before they arrived is left as it was set. `runPrefsMigrations` takes a third argument, the names to migrate, for that. Another writer deleting `$version` is read as a cleared store, and migrates nothing.
  
  Breaking for a caller of `watchPrefsVersion`: it takes the migrations, `watchPrefsVersion(cache, migrations)`, where it took their count.
  
  `OwnedRecordCache` gains `onOverruled(listener)`, which reports another writer's changes the cache did not take because its own write to the record was queued or on its way. The prefs version watch listens there too, so a newer build's `$version` still stops this build persisting when it lands during this build's own write of that record.
- 812118e: New `@weasel-js/storage` package: the storage adapters and `RecordCache` that lived in labkit, split into one module per adapter. localStorage, sessionStorage, memory, and the no-op adapter gain `listSync`, and `openRecordsSync` opens a record cache over them without awaiting. `fallbackStorage(preferred, fallback, label)` wraps an adapter with a fallback for when it is unavailable, and `createDefaultStorage(preferred, label)` builds a page-wide default from one: `preferred`, or localStorage where it will not open, chosen once. Storage's own `indexedDbAdapter` and `defaultStorage` use the IndexedDB database `'weasel'`. `RecordCache.flush()` now resolves `true` when every queued write landed and `false` otherwise; it used to resolve to nothing. labkit re-exports the adapters, and its `indexedDbAdapter` and default storage stay on the database `'labkit'`, where every existing lab's records are.
  
  New `@weasel-js/prefs` package: the preferences schema, moved out of core, and a store for it. `openPrefs` and `openPrefsSync` keep one record per leaf and repair values against the schema on read. `store.stored()` returns the raw stored records as a tree, orphans included, and `usePrefsValues` returns it as `stored`. Versioned migrations run on open: a malformed `$version` opens the store read-only, and a newer `$version` written by another writer stops this store from persisting. `Infinity` and `-Infinity` on number leaves are stored as the strings `'Infinity'` and `'-Infinity'`. `PrefsStore.flush()` resolves a boolean, with the same meaning as `RecordCache.flush()`. The `usePref` and `usePrefsValues` hooks, imported from `@weasel-js/prefs/react`, produce the values `PrefsForm` takes; the main entry loads no React.
  
  Breaking: the schema types are renamed from `ToolPref*` to `Pref*` (`ToolPref` itself is `BuiltinPref`, `TOOL_PREF_KINDS` is `PREF_KINDS`, `isBuiltinToolPref` is `isBuiltinPref`) and are imported from `@weasel-js/prefs`. Neither core, ui, nor `@weasel-js/labkit/weasel-ui` re-exports them, nor ui's `isPrefLeaf`, `prefValueAtPath`, `visiblePrefSubtree`, `filterPrefSubtree`, or `prefDisplayBounds`. labkit's cross-tab BroadcastChannel is renamed, so tabs on an older and a newer labkit stop hearing each other until both reload.
- d113843: A record cache sends one batch of writes at a time. Two flushes close together (the debounce and a `pagehide`, or an explicit `flush()`) used to send two overlapping batches, with two consequences. A write storage rejected was queued again even when a newer write to the same record had already landed, so the retry put the older value back in storage while memory kept the newer one. And `flush()` resolved true, and `close()` returned, while an earlier batch was still on its way and could yet fail. `flush()` now resolves once everything queued before it has landed or been refused.
- 9de4985: A record cache whose first read fails now recovers. This changes behavior: `openRecords` and `openRecordsSync` used to answer a failed read with a cache that stayed empty and read-only until the page reloaded. It now reads again on a backoff, starting at `retryMs` (default 1000 ms) and doubling to `retryMaxMs` (default 30000 ms), and `cache.read()` tries at once. When a read lands, the cache holds the records, reports them to listeners as one batch of `remote` changes, hears other writers, and turns `writable` on. Records set or deleted while it waited win over what was read and are then written, and a delete made while unread is now queued even though the cache holds no such record. `retryMs: false` keeps the old behavior, and a cache its opener stopped with `stopWriting()` stays read-only and stops retrying. `RecordCache` gains the `read()` method, which anything implementing the interface by hand must add.
  
  A prefs store opened while its storage was away therefore shows the stored values and starts persisting once the read lands. `PrefsStore` gains `read()` to try at once, `writable` turns true when it does, and a store with migrations now also stops persisting when the records that arrive late carry a version newer than the build knows. Migrations are not rerun over records that arrive late.
  
  labkit's lab store opens its records with `retryMs: false`, so a lab whose storage could not be read stays empty and unsaved for the session, as before. `<Persistence>` uses the default and recovers.
- b23225f: A record cache no longer loses a write its adapter rejects. The write stays queued and is sent again on a backoff (`retryMs`, doubling to `retryMaxMs`, the options a failed first read already used), unless a newer write to the same record has been queued since. `flush()` resolves false until it lands, where the flush after a rejected write used to resolve true with storage never having taken the value. With `retryMs: false` a rejected write waits for the next flush. The warning is logged once per outage, and now reads `could not write "<key>"; trying again`.
  
  A cache also keeps its own write over another writer's change that arrives while that write is on its way to storage. Before, only a write still waiting on the debounce was protected, so a tab could show the other writer's value while storage held its own.
- 72a40c5: Setting a record to `undefined` deletes it. `RecordCache.set(name, undefined)` used to hold the record as present while telling listeners it was deleted, and each adapter then did something different: localStorage stored the text `undefined`, which read back as a string, and IndexedDB stored a record other tabs heard as a delete. Through `PrefsStore.set`, clearing a clearable enum in a prefs form left the leaf counted as set, with that stray record behind it. It now unsets the leaf.
- a66fcf5: `RecordCache.whenRead()` and `PrefsStore.whenRead()` resolve once storage has been read: at once for one that opened with its records, and when a later read lands for one whose first read failed. Work an opener does once at open can rerun there.
  
  Prefs use it to record `$version` when a late first read finds nothing stored; before, values set while storage was away were persisted with no version, and the next open migrated them from 0. A `$version` another writer deletes, as clearing the store does, is written back for the same reason.
- b18c036: `urlHashAdapter` survives a fragment that is not its own. A fragment decoding to JSON other than an object of strings (`null`, a number, an array) made every `get`, `list`, and `set` reject and the `hashchange` handler throw; it now reads as holding no records. Writes also keep `history.state` instead of replacing it with `null`, so a router's state survives a save.
