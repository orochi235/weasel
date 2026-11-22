---
'@weasel-js/core': patch
---

Inserting a node again while its `animateLifecycle` exit runs replaces the leaving node instead of throwing on the repeated id.

<!-- entry: fix -->
