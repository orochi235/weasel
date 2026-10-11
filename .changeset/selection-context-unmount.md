---
'@weasel-js/core': patch
---

`SelectionContext` went on reporting a canvas's selection after that canvas unmounted. `usePublishSelection` now clears the selection it published when its component goes away, unless another publisher has written since.
