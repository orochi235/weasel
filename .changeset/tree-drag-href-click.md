---
'@weasel-js/ui': patch
---

A `Tree` row with an `href` takes clicks the same way when the tree has `onMove`. A plain click activates it without following the link, and a Cmd, Ctrl or Alt click is left to the browser without activating it.

<!-- entry: fix -->
