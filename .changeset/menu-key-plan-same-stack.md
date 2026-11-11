---
"@weasel-js/menu": patch
---

A typeahead letter or access letter that lands on the row already highlighted leaves the menu as it was: `planKey` hands back the same stack, and the controller no longer notifies subscribers for it.
