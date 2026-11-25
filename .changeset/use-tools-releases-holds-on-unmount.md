---
'@weasel-js/routing': patch
---

A canvas that unmounts releases the tools its `engageHotkey` held, so a canvas mounted again under the same `WeaselProvider` does not start with one of them engaged.

<!-- entry: fix -->
