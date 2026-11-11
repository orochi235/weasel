---
"@weasel-js/audio": patch
---

A Web Audio synth note gated exactly at the end of its attack, with no decay, reaches full level before it releases. It steps to its sustain and then releases, as `envelopeLevel` and the worklet voices do.

<!-- entry: fix -->
