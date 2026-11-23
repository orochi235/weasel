---
'@weasel-js/loupe': patch
---

`createLoupeModel` throws a `TypeError` on a surface that implements only one of `worldAt` and `pointFor`.

A surface implements both or neither. With only one, the pin was read in the wrong space.

<!-- entry: fix -->
