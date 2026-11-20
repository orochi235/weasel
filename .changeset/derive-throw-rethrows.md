---
'@weasel-js/core': patch
---

A `derivePose` or `derivePath` that throws on a re-derive throws again on the next read, instead of answering its previous result from then on.

<!-- entry: fix -->
