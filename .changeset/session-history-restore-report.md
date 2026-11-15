---
'@weasel-js/editor': minor
---

`useSessionPersistence` reports how each saved undo stack restored, and can keep one naming ops this build cannot replay.

`onHistoryRestore` hears each restore, and `historyRecovery: 'best-effort'` keeps such a stack. Under the default, `'strict'`, such a stack is dropped and `onHistoryRestore` receives `{ error }`; otherwise it receives `{ report }`.

<!-- entry: new api -->
