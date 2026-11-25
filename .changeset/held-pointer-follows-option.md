---
'@weasel-js/routing': patch
---

Changing `useGestureDispatcher`'s `heldPointer` callback hands the held-pointer feed to the new callback and `null` to the old one, so autoscroll keeps working after the callback is replaced.

<!-- entry: fix -->
