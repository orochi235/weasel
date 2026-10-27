---
'@weasel-js/renderer': patch
---

Looking up a text command's layout and painting builds no options or result objects per command per frame: the renderer refills one of each. Every text command drawn pays this, unchanged ones included.
