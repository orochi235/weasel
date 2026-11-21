---
'@weasel-js/ui': patch
'@weasel-js/routing': patch
---

`LastOperationPanel` and `useLastOperation` work with a `LastOperationStore` written as a class: they call its methods on the store rather than detached.

<!-- entry: fix -->
