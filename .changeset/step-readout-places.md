---
'@weasel-js/ui': patch
---

A number field given no `display` shows as many decimal places as its `step` is written with. A step of 0.25 used to show one place, so 0.25 read `0.3`, and a step of 2.5 showed none, so 7.5 read `8`.
