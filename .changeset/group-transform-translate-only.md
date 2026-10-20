---
'@weasel-js/core': patch
---

`GroupTransform` is now only `{ kind: 'translate', dx, dy }`. Its `scale` and `rotate` arms are gone: no gesture produced them, and the move and clone actions ignored a behavior that answered one. A move behavior that switched on `kind` to handle them no longer needs those branches; resize and rotate behaviors answer through `ResizeMoveResult` and `RotateMoveResult` as before. Breaking for code that names the removed arms.
