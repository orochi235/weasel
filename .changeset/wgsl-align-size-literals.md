---
'@weasel-js/renderer': patch
---

A WGSL uniform struct reads `@align` and `@size` written as a suffixed literal such as `16u` or as a module-scope const.

One whose argument is an expression is refused with an error naming it.

<!-- entry: fix -->
