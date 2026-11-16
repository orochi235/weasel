---
'@weasel-js/core': major
---

`removePage`, `movePage`, `resizePage` and `renamePage` throw on a page id the scene does not have.

This is breaking: such a call used to return having done nothing, including on a scene with no pages. Check the id first where it may be stale, as `usePages().remove` already does through `pageRemoval`.

<!-- entry: breaking behavior -->
