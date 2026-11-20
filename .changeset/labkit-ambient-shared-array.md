---
'@weasel-js/labkit': patch
---

Two components passing the same array to `useLabAmbient` keep its bindings installed until both have unmounted.

<!-- entry: fix -->
