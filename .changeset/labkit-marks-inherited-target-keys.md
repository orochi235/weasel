---
"@weasel-js/labkit": patch
---

An annotation target named `__proto__`, `constructor`, or another key every object inherits is a target like any other. A store read back from a save threw when such a target took its first mark, and a save lost the marks and undo history of a target named `__proto__`.
