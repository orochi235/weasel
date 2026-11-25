---
'@weasel-js/cursor': patch
---

A cursor sink with no base leaves a painted override that other code set on its painted-cursor state, as it already leaves another writer's cursor on the element.

<!-- entry: fix -->
