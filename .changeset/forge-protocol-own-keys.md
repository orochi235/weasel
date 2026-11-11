---
"@weasel-js/forge": patch
---

A story control keyed like an `Object.prototype` member reaches the workshop. A schema described for the frame port and rebuilt in the workshop keeps an entry keyed `__proto__`, which had replaced the description's prototype and vanished, and the frame reports that entry's validation errors as its own. The workshop reads no errors for a control named `toString` or `constructor` that has none, where it had handed the control's row a function.
