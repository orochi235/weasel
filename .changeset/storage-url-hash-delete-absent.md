---
"@weasel-js/storage": patch
---

`urlHashAdapter.delete` of a key the fragment does not hold leaves the fragment alone. It rewrote it, replacing a fragment the page did not write, such as an anchor, with an empty record map.
