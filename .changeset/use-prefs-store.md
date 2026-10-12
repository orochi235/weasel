---
'@weasel-js/prefs': patch
---

Adds API: `usePrefsStore(schema, options)` in `@weasel-js/prefs/react`, a store open for as long as the component calling it is mounted. It opens during the first render, from an adapter that reads synchronously, so that render has values, and closes with its queued writes sent on unmount. One store is open per `storage` and `prefix`: components naming the same pair share it, and StrictMode's second mount and a fast refresh get the store already open, never a second writer. A new `schema`, `storage`, or `prefix` closes the store and opens the one asked for; a new `options` object alone does nothing.
