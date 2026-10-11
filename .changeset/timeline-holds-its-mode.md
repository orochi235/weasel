---
'@weasel-js/ui': patch
---

`Timeline`: with no `mode` prop the Graph switch works, holding the mode itself as it does `selection` and `window`. It was wired to `onModeChange` alone and did nothing without a caller holding the mode.
