# @weasel-js/storage

## 1.19.1

### Minor Changes

- a4ef496: `onLeave(fn)` runs a flush when the page goes away or turns hidden, the moment a record cache already flushes its writes.
  
  ```ts
  import { onLeave } from '@weasel-js/storage';
  
  const stop = onLeave(() => saveNow(), { capture: true });
  ```
  
  `capture` runs it ahead of other flushes on the same event. It may run twice for one leave, so `fn` writes only what is still pending.
  
  <!-- entry: api -->

### Patch Changes

- f265a52: An IndexedDB adapter warns when its upgrade waits on another tab. Its reads and writes stay pending until that tab closes the database.
  
  <!-- entry: fix -->
- Updated dependencies [8562ebe]
  - @weasel-js/registry@1.19.1

## 1.19.0

### Patch Changes

- 0f8e7cc: Deleting a record again while its first delete is still waiting to be written does nothing.
  
  <!-- entry: rank=-5 fix -->
- 1077865: `isPlainObject` and `isPlainPrototype` no longer take an object whose prototype is a bare `Object.create(null)` for another realm's plain object. `deepEqual` and everything else that asks follow, and `@weasel-js/storage`'s JSON adapters no longer warn about a foreign object carrying `Symbol.toStringTag`.
  
  <!-- entry: rank=-5 fix -->
- 851bf17: The JSON storage adapters write a `bigint` as its decimal digits, with a warning, rather than rejecting the write.
  
  That is `localStorageAdapter`, `sessionStorageAdapter` and `urlHashAdapter`.
  
  <!-- entry: fix -->
- 851bf17: The JSON storage adapters no longer warn about a plain object from another realm, such as an iframe's or one `structuredClone` built.
  
  `localStorageAdapter`, `sessionStorageAdapter` and `urlHashAdapter` now warn about an array whose hole sits beside an extra key, which JSON changes.
  
  <!-- entry: fix -->
- 623c0b8: A record cache rereads a record that another writer changed during the cache's own write, so cache and storage cannot disagree for good.
  
  Such a change still reaches `onOverruled` when heard; a different value read back reaches listeners as a remote change.
  
  <!-- entry: fix -->
- 2c6c317: `urlHashAdapter.delete` of a key the fragment does not hold leaves the fragment, such as a page anchor, alone.
  
  <!-- entry: rank=-5 fix -->
- 7ca4c3d: `encodeUrlHash` writes a lone surrogate as U+FFFD, with a warning, instead of throwing a `URIError`.
  
  <!-- entry: rank=-5 fix -->
- Updated dependencies [b1309b2]
- Updated dependencies [1077865]
- Updated dependencies [b1309b2]
- Updated dependencies [b1309b2]
- Updated dependencies [1077865]
- Updated dependencies [1077865]
- Updated dependencies [2bf3397]
- Updated dependencies [1077865]
- Updated dependencies [1077865]
- Updated dependencies [b1309b2]
  - @weasel-js/registry@1.19.0

## 1.18.2

### Patch Changes

- Updated dependencies [b188aea]
  - @weasel-js/registry@1.18.2

## 1.18.1

### Patch Changes

- 21957cc: Fixes from a bug audit of the storage, loupe, P-touch, hud and labkit packages.
  
  - `createIndexedDbAdapter` now creates its `store` in a database that already exists without it, by upgrading the database one version, so two adapters can keep separate stores in one database (the default `'weasel'` included). It also opens a database some other code has taken past version 1, which used to fail with a `VersionError` and leave every read and write rejected. The upgrade waits, as any IndexedDB upgrade does, until other connections to the database close; this adapter's own connections close for it.
  - A captured `CanvasSource` read after its canvas grew answers `null` for a point past the last captured frame, instead of the pixel the previous read left behind.
  - `writeLbx` and `sceneToLbx` place `lbxObjects` inside a rect clip whose width or height is negative, which they used to skip as cut by the clip.
  - A loupe aimed where nothing is drawn now reports no color: `color` becomes `null` and `onColorChange` is called with `null`, where it used to keep showing the last color it read. Its readout then matches what an eyedropper click there takes, which is nothing. Breaking for TypeScript callers: `onColorChange` is typed `(hex: string | null) => void` on `createLoupeModel`, hud's `createLoupe` and `LoupeEvents`, and labkit's loupe options, so a handler typed for `string` alone needs widening.
- @weasel-js/registry@1.18.1

## 1.18.0

### Patch Changes

- bf2e0c3: Fix teardown gaps in storage and audio.
  
  - `createMemoryAdapter` no longer reports a change to a subscriber that unsubscribed while the change was on its way.
  - A record cache no longer sends a write made while its `close()` was still flushing.
  - `engine.analyser()` throws once the audio engine is disposed, as `engine.graph()` does, instead of handing out a tap nothing tracks.
  - The audio engine stops listening for unlock gestures once its context closes, rather than calling `resume()` on a closed context at every press.
- Updated dependencies [b93c1dd]
  - @weasel-js/registry@1.18.0

## 1.17.3

### Patch Changes

- @weasel-js/registry@1.17.3

## 1.17.2

### Patch Changes

- 548a4a0: The IndexedDB adapter's `list` finds every key under its prefix. It used to miss a key whose text after the prefix began with `￿` and went on past it.
- 959ac9b: The localStorage, sessionStorage and URL-hash adapters warn about a value holding `-0` or an array with holes, which JSON reads back as `0` and `null`.
- 9298f90: `RecordCache.close()` resolves whether every queued write landed, as `flush()` does, since a write still queued once it closes is never sent. `PrefsStore.close()` and the lab store's `close()` pass that answer on. All three used to resolve `void`, so a failed final write went unreported. This breaks code that implements one of these interfaces with a `close` resolving `void`: it now has to resolve a boolean.
- ab39d07: Every adapter deletes a key set to `undefined`, as a record cache already did. localStorage and sessionStorage used to store the text `undefined` and read it back as that string, and the memory and IndexedDB adapters kept the key, listing it with no value.
- eb24621: `urlHashAdapter` warns once per key about a value JSON cannot keep exactly, as the localStorage and sessionStorage adapters do. A `Date`, `Set` or `Map` stored in the fragment used to change shape with no warning.
- @weasel-js/registry@1.17.2

## 1.17.1

### Patch Changes

- @weasel-js/registry@1.17.1

## 1.17.0

### Patch Changes

- @weasel-js/registry@1.17.0

## 1.16.2

### Patch Changes

- @weasel-js/registry@1.16.2

## 1.16.1

### Patch Changes

- Updated dependencies [25a1ff7]
  - @weasel-js/registry@1.16.1

## 1.16.0

### Patch Changes

- @weasel-js/registry@1.16.0

## 1.15.2

### Patch Changes

- Updated dependencies [f1906a8]
  - @weasel-js/registry@1.15.2

## 1.15.1

### Patch Changes

- @weasel-js/registry@1.15.1

## 1.15.0

### Patch Changes

- @weasel-js/registry@1.15.0

## 1.14.2

### Patch Changes

- Updated dependencies [4bba14d]
  - @weasel-js/registry@1.14.2

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
