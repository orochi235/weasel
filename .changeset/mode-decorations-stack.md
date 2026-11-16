---
'@weasel-js/modes': patch
---

Mode decoration painters registered for the same mode stack: the newest paints, and releasing it brings back the one beneath.

Releasing a buried painter removes only it. Before, a second registration replaced the first for good.

<!-- entry: fix behavior -->
