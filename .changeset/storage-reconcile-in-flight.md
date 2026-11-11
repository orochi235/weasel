---
"@weasel-js/storage": patch
---

A record cache reads a record back from storage once its write lands, when another writer changed that record while the write was on its way. It used to ignore that change as overruled, on the reading that its own write landed after it; with a substrate that reports a write to other caches before the writer's promise resolves, the other writer's could have landed last, and the cache then held its own value for good while storage held the other. Such a change still reaches `onOverruled` when heard; a different value read back reaches listeners as a remote change.
