---
'@weasel-js/storage': patch
---

`urlHashAdapter` warns once per key about a value JSON cannot keep exactly, as the localStorage and sessionStorage adapters do. A `Date`, `Set` or `Map` stored in the fragment used to change shape with no warning.
