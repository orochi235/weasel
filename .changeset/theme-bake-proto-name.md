---
"@weasel-js/theme": patch
---

`bake` leaves a token named like an `Object.prototype` member, such as `constructor`, out of a selection that does not produce it.

<!-- entry: rank=-5 fix -->
