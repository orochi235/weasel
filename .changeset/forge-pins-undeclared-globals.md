---
"@weasel-js/forge": patch
---

A trial's pins take no `__proto__` or `toString` pin for a global the lab does not declare. The lab's stored globals read only their own keys.

<!-- entry: rank=-5 fix -->
