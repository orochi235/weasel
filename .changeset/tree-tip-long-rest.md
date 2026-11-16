---
'@weasel-js/ui': patch
---

`Tree` waits out a `tree.tipRestMs` longer than 2³¹ − 1 ms before a row's tooltip opens, instead of opening it at once.

<!-- entry: fix -->
