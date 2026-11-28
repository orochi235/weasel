---
'@weasel-js/routing': patch
---

A paste the dispatcher holding the keys does not bind goes on to the other dispatchers on the same element, as a keystroke already does, so a `paste` binding on any of them fires.

<!-- entry: fix -->
