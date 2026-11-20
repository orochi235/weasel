---
'@weasel-js/routing': patch
---

Adjusting the last operation no longer undoes it when the action throws on the rerun. The operation stays as it was, and the panel lets it go.

<!-- entry: fix -->
