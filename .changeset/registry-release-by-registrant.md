---
'@weasel-js/registry': patch
---

Adds API: `Reflectable.release(key, registrant)` removes exactly one registrant from a key's stack, live or shadowed, whether `push` or `set` wrote it, and returns whether it was there. Removing the live one uncovers the one beneath. It shares one removal path with the function `push` returns, so releasing by either makes the other a no-op.

Adds API: `ReflectedEntry.live` is the registrant holding the key. It is the same frozen object in every snapshot, and the one `shadowed` lists once something displaces it, so a row drawn from `reflection.entries()` can hand any registrant it shows straight to `release`. `value` and `source` stay on the entry as they were.
