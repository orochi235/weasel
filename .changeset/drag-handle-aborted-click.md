---
'@weasel-js/core': patch
---

Fixes: a `useDragHandle` drag that was aborted while the button was still down, as when the component holding the hook unmounts mid-drag, then released over its source element, delivered a click to that element. The click guard now stays until the pointer is released, canceled, or pressed again. A drag the browser cancels still drops the guard at once, since no release follows it.
