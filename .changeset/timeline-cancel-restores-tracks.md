---
'@weasel-js/ui': patch
---

Canceling a `Timeline` key drag hands `onInput` the tracks as they were before it, so keys sharing a time keep their order.

<!-- entry: fix -->
