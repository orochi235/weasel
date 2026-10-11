---
'@weasel-js/ui': patch
---

`UnitField` takes `onCancel`, called when typing that reached `onInput` is abandoned by Escape or by text it cannot read. A field that began at NaN (a mixed selection) has no starting value to send back, so this is how its caller learns to drop the live value. `PropertyField`'s number field passes an `onCancel` through to it.
