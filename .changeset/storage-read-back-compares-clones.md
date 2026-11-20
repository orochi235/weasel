---
'@weasel-js/storage': patch
---

A record cache reads back an unchanged `Map`, `Set`, `Date`, or typed array after a contested write without reporting a remote change.

<!-- entry: fix -->
