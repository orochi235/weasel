---
'@weasel-js/labkit': patch
---

A lab can persist to any substrate, and two tabs of one lab no longer discard
each other's work.

`StorageAdapter` is asynchronous and stores structured-clone values:
`get`, `list(prefix)`, `set`, `delete`, and an optional `subscribe` that reports
writes made by someone else. New `createIndexedDbAdapter` / `indexedDbAdapter`
keep binary and non-JSON state and hear other tabs through a
`BroadcastChannel`; the localStorage and URL-hash adapters hear them through the
`storage` and `hashchange` events.

A lab is stored as one record per trial, snapshot, layout and so on, under one
prefix, and the newest write to a record wins — an edit to one trial in one tab
and to another trial in a second tab both survive. Existing labs fold forward
on first open; the old document is deleted only once the records read back.

`<Lab storageKey="…">` alone now persists (to IndexedDB, falling back to
localStorage), shows `fallback` — by default the empty shell — while it loads,
and opens once under StrictMode. `usePersistedState(name, initial)` is
`useState` whose value survives a reload, and `<Persistence>` provides it
outside a lab.

**Breaking:** custom `StorageAdapter`s must implement the async methods.
`createLabStore` no longer takes storage — `openLabStore` reads a stored lab.
`<Lab storage>` without `storageKey` is a type error, and `storage={null}` is
gone (omit both). `FloatingPanel`'s `storageKey` is replaced by `persist`, which
remembers only inside a lab or `<Persistence>`. `AnnotationStorage.load` returns
a promise. `SingletonExperimentProvider` renders its `fallback` until loaded.
