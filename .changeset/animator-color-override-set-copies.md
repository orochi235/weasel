---
'@weasel-js/animator': patch
---

`animator.colorOverrides.set` keeps a copy of an array it is given, so setting the same array again after editing it in place repaints.

<!-- entry: fix -->
