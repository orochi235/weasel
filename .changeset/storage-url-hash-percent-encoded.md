---
'@weasel-js/storage': patch
---

`urlHashAdapter` and `decodeUrlHash` read a fragment that a link rewriter percent-encoded, rather than reading it as empty.

<!-- entry: fix -->
