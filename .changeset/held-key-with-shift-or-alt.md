---
'@weasel-js/routing': patch
'@weasel-js/labkit': patch
---

A hold-a-key trigger that is not itself a modifier now engages while Shift or Alt is down: hold Shift, then Space, and the hand tool is pushed. Cmd and Ctrl still bar it, so a letter trigger leaves its browser chord alone. `heldKeySpec` carries the rule, so labkit's loupe peek key follows it too.
