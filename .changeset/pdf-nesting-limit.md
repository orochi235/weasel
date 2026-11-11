---
"@weasel-js/pdf": patch
---

Groups nested past 512 deep are left out of the page and reported (`groups nest more than 512 deep; what is deeper
is not drawn`), as the SVG reader caps nesting. A drawing nested some tens of thousands deep overflowed the stack
and failed the whole file with a `RangeError`.
