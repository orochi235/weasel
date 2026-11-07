---
'@weasel-js/devtools': patch
---

A devtools client request about a root rejects when the page removes that root, or says `sup` without it. Such a request used to stay pending for good, since the page never answers it, so a view reading that root waited forever.
