---
'@weasel-js/clock': minor
---

A second clock under the same id now shadows the first, and releasing it brings the first back.

It used to replace the first and leave the id empty once released. Every other kit registry already works this way.

<!-- entry: behavior -->
