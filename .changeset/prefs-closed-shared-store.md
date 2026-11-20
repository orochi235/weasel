---
'@weasel-js/prefs': patch
---

A write through a store from `usePrefsStore` after it has closed no longer reaches storage or another component's store on the same prefix.

<!-- entry: fix -->
