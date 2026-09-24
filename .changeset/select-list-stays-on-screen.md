---
'@weasel-js/ui': patch
---

A `Select` whose list opens over its trigger no longer runs past the window edge. Near the top of the window, with a late option chosen, the list stops 12px inside the edge rather than lining its selected row up with the trigger.
