---
'@weasel-js/editor': minor
---

`useSessionPersistence` stamps each saved scene with when it was saved, read back with the new `savedAtOf(value)`.

The stamp is a `savedAt` field, in milliseconds since the epoch, on the scene entry; `savedAtOf` returns `undefined` for an entry saved before it. An app keeping a session in two storages can open the newer copy by it.

<!-- entry: api data -->
