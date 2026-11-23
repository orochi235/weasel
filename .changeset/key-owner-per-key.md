---
'@weasel-js/gestures': patch
'@weasel-js/routing': patch
---

A page-level Enter shortcut fires while a checkbox, radio, or switch has focus, and a Space shortcut while a link has focus, since those keys do not activate them.

A native checkbox or radio inside a form still keeps Enter, which submits the form.

<!-- entry: fix behavior -->
