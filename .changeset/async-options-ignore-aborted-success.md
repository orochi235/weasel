---
'@weasel-js/ui': patch
---

`useAsyncOptions` ignores a superseded request that resolves anyway. A `load` that does not honor its abort signal could resolve an older query after a newer one was issued; its options were shown as current and `isLoading` went false while the newer request was still pending. An aborted request's result is now dropped whether it rejects or resolves.
