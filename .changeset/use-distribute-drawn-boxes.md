---
'@weasel-js/core': patch
---

`useDistribute` takes `scene` and `viewScale`, as `useAlign` does, and with them spaces a stroked node by the box it is drawn with. It used to space pose boxes only, so a hook-driven distribute and align disagreed on where a stroked node's edge was.
