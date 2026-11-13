---
'@weasel-js/labkit': patch
---

A `Split` too narrow for its stored sidebar and the content floor lays the content inside the strip from the first frame, not after load.

`Split` wraps its strip in a `lk-split__frame` element with `display: contents`, which it measures from.

<!-- entry: fix visual -->
