---
'@weasel-js/ui': patch
---

A `ToastRegion` given a `portalContainer` no longer holds its next toast open after the last one was closed under the pointer. The region unmounts without a pointer-leave, so it went on believing it was hovered, and the next toast's timer could stay paused until the pointer entered and left the stack again.
