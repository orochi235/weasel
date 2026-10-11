---
'@weasel-js/core': patch
---

`window.__weaselTest` now passes to the next canvas when the one answering it unmounts. With two canvases on a page it answers for the earliest still mounted, where it used to disappear with the first.
