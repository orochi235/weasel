---
'@weasel-js/core': patch
---

A camera move on a shared animator stops when the component that started it unmounts. This covers `useViewAnimationOn` and `useViewAnimation` given an animator.

<!-- entry: fix behavior -->
