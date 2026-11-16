---
'@weasel-js/core': minor
---

`contentHandlerRegistry` lists the content handlers registered for every canvas, by id, and a handler registered under a taken id stands in for the one there.

Only the live handler of each id runs; releasing it brings back the one it shadowed. Before, two handlers sharing an id both ran. The reflection reports the shadowed ones, so a conflict between an app's handler and a plugin's can be seen.

<!-- entry: api behavior -->
