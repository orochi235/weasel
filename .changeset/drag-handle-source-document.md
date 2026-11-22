---
'@weasel-js/core': patch
---

`useDragHandle` finds drop zones in the document its source is rendered in, so a drag inside a pop-out window or an iframe portal drops there.

<!-- entry: fix -->
