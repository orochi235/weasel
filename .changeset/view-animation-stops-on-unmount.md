---
'@weasel-js/core': patch
---

A camera move started through `useViewAnimationOn`, or `useViewAnimation` given an animator, stops when the component that started it unmounts, as one on the hook's own animator already did.

<!-- entry: fix behavior -->
