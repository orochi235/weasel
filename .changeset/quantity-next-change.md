---
'@weasel-js/quantity': minor
---

`nextChangeFor(q, rate)` says how long until a moving value's text next changes, so a live readout can sleep until then.

The answer is in the unit of time `rate` is per: `nextChangeFor(tag(12.2, duration()), 1)` is `0.3`, when `0:12` turns `0:13`. A negative rate counts down, and a rate of 0 never changes. A display kind can answer for itself through a new optional `DisplayKind.nextChange`; one without it is searched through its own `format`.

<!-- entry: rank=5 new api -->
