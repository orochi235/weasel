---
'@weasel-js/ui': patch
---

`CurveEditor` kept drawing the points of its last gesture when the consumer had rounded them or left `value` alone, until some later `value` change. Once a gesture ends the editor draws `value` again, so a `CurveField` with a `step` shows the stepped curve. A consumer that never writes `onInput` back to `value` now sees each edit snap back.
