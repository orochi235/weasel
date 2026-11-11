---
"@weasel-js/clock": patch
---

A `declare` or `override` the clock refuses with a `RangeError` no longer keeps the values it refused. An override of `{ duration: -1 }` used to stay in force, so every later `declare` threw too; a refused declaration did the same to the next `override`. A declaration's own `duration` and `origin` are now checked while an override stands over them, rather than when the override is lifted.
