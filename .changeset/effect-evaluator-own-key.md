---
'@weasel-js/diagram': patch
---

An effect stage whose `type` names an `Object.prototype` member, such as `toString`, fails with "no evaluator" instead of rejecting the run.

<!-- entry: fix -->
