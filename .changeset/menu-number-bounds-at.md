---
'@weasel-js/routing': patch
---

A number row in a schema menu now honors the leaf's `minAt` and `maxAt`, read from the menu's values the way a form or a selection panel reads them, so a menu cannot set a value those panels would refuse.
