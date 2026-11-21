---
'@weasel-js/ui': patch
---

Switching a `TokenPanel` scale with a base of zero or below to per-step factors keeps every step's amount. Its base moves to the first positive step.

<!-- entry: fix -->
