---
'@weasel-js/audio': patch
---

`engine.analyser('')` taps the bus named `''`, as `bus('')` and `play({ bus: '' })` use it, rather than the master.

<!-- entry: fix -->
