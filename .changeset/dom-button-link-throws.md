---
'@weasel-js/ui': patch
---

`domButton.measure` throws on a `variant: 'link'` button, which draws as inline text, rather than returning a control box.

<!-- entry: fix behavior -->
