---
'@weasel-js/ui': patch
---

A held `UnitField` stepper stops repeating when the value reaches its bound. The repeat ended only on the button's own release, and the button is disabled at the bound while still held; where the release never reached it, the field went on sending the bound through `onInput` every 60 ms and wiping anything typed until it unmounted.
