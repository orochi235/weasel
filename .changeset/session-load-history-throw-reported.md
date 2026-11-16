---
'@weasel-js/editor': patch
---

`useSessionPersistence` reports a `loadHistory` that throws to `onHistoryRestore` as `{ status: 'failed', error }`.

With no `onHistoryRestore`, the error is logged with `console.error`.

<!-- entry: fix -->
