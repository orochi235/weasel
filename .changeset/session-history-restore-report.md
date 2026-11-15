---
'@weasel-js/editor': minor
---

`useSessionPersistence` reports how each saved undo stack restored, and can keep one naming ops this build cannot replay.

`onHistoryRestore` hears each saved stack it reads, with `restorePairedHistory`'s answer: `{ status: 'restored', report }`, or `'unpaired'`, `'mismatched'` or `'stale'` for a stack it dropped. `historyRecovery: 'best-effort'` keeps a stack naming ops this build cannot replay; under the default, `'strict'`, that stack is dropped and `onHistoryRestore` receives `{ status: 'failed', error }`.

<!-- entry: new api -->
