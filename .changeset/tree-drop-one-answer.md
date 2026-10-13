---
'@weasel-js/ui': patch
---

Breaking: `Tree` no longer takes `onExternalTarget`. It reported where a drag begun outside the tree would land from an effect, a render behind the pointer; `dropRef`'s `targetAt(point)` answers the same question for any point at the moment it is asked, and is now the one way to ask. Removed on an agent's judgment: nothing in the repo read the callback.
