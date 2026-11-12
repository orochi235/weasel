---
'@weasel-js/editor': minor
---

`sessionSaveReporter(notice)` reports a document the browser refuses to store. Pass it as `onSaved` to `useAutosave` or `useSessionPersistence`: it raises a toast that stays up while saves fail and takes it down when one lands.

<!-- entry: api new -->
