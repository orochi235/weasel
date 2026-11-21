---
'@weasel-js/forge': patch
---

Removing or reordering an entry of a CSF list arg keeps each other entry's own callbacks. They no longer move to whichever entry now sits at their index.

<!-- entry: fix -->
